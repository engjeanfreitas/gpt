//! Minimal Win32 bindings. No injection, keyboard hooks, screenshots, or elevation.
use std::{
    ffi::c_void,
    ptr,
    sync::atomic::{AtomicBool, Ordering},
};

type Handle = *mut c_void;
type WindowProc = unsafe extern "system" fn(Handle, u32, usize, isize) -> isize;
#[repr(C)]
struct LastInputInfo {
    size: u32,
    time: u32,
}
#[repr(C)]
struct Point {
    x: i32,
    y: i32,
}
#[repr(C)]
struct Message {
    hwnd: Handle,
    message: u32,
    wparam: usize,
    lparam: isize,
    time: u32,
    point: Point,
    private: u32,
}
#[repr(C)]
struct WindowClass {
    style: u32,
    wnd_proc: Option<WindowProc>,
    cls_extra: i32,
    wnd_extra: i32,
    instance: Handle,
    icon: Handle,
    cursor: Handle,
    background: Handle,
    menu: *const u16,
    name: *const u16,
}

#[link(name = "user32")]
unsafe extern "system" {
    fn GetForegroundWindow() -> Handle;
    fn GetWindowTextW(window: Handle, text: *mut u16, max: i32) -> i32;
    fn GetWindowThreadProcessId(window: Handle, process: *mut u32) -> u32;
    fn GetLastInputInfo(info: *mut LastInputInfo) -> i32;
    fn OpenInputDesktop(flags: u32, inherit: i32, access: u32) -> Handle;
    fn CloseDesktop(desktop: Handle) -> i32;
    fn GetUserObjectInformationW(
        handle: Handle,
        index: i32,
        data: *mut c_void,
        length: u32,
        needed: *mut u32,
    ) -> i32;
    fn RegisterClassW(class: *const WindowClass) -> u16;
    fn CreateWindowExW(
        ex_style: u32,
        class: *const u16,
        name: *const u16,
        style: u32,
        x: i32,
        y: i32,
        width: i32,
        height: i32,
        parent: Handle,
        menu: Handle,
        instance: Handle,
        param: *mut c_void,
    ) -> Handle;
    fn DefWindowProcW(window: Handle, message: u32, wparam: usize, lparam: isize) -> isize;
    fn GetMessageW(message: *mut Message, window: Handle, min: u32, max: u32) -> i32;
    fn TranslateMessage(message: *const Message) -> i32;
    fn DispatchMessageW(message: *const Message) -> isize;
}
#[link(name = "kernel32")]
unsafe extern "system" {
    fn GetTickCount() -> u32;
    fn OpenProcess(access: u32, inherit: i32, id: u32) -> Handle;
    fn QueryFullProcessImageNameW(
        process: Handle,
        flags: u32,
        name: *mut u16,
        length: *mut u32,
    ) -> i32;
    fn CloseHandle(handle: Handle) -> i32;
    fn GetModuleHandleW(name: *const u16) -> Handle;
}
#[link(name = "wtsapi32")]
unsafe extern "system" {
    fn WTSRegisterSessionNotification(window: Handle, flags: u32) -> i32;
}
#[link(name = "winmm")]
unsafe extern "system" {
    fn PlaySoundW(sound: *const u16, module: Handle, flags: u32) -> i32;
}

static LOCKED: AtomicBool = AtomicBool::new(false);
static SUSPENDED: AtomicBool = AtomicBool::new(false);

pub struct WindowObservation {
    pub app: String,
    pub title: String,
    pub idle_seconds: u64,
    pub locked: bool,
}

fn desktop_is_locked() -> bool {
    unsafe {
        let desktop = OpenInputDesktop(0, 0, 1); // DESKTOP_READOBJECTS
        if desktop.is_null() {
            return true;
        }
        let mut name = [0u16; 256];
        let mut needed = 0;
        let ok = GetUserObjectInformationW(
            desktop,
            2,
            name.as_mut_ptr().cast(),
            (name.len() * 2) as u32,
            &mut needed,
        );
        CloseDesktop(desktop);
        if ok == 0 {
            return true;
        }
        let length = name.iter().position(|v| *v == 0).unwrap_or(name.len());
        !String::from_utf16_lossy(&name[..length]).eq_ignore_ascii_case("default")
    }
}
pub fn read_window(idle_threshold: u64) -> Option<WindowObservation> {
    if LOCKED.load(Ordering::Relaxed) || SUSPENDED.load(Ordering::Relaxed) || desktop_is_locked() {
        return Some(WindowObservation {
            app: String::new(),
            title: String::new(),
            idle_seconds: 0,
            locked: true,
        });
    }
    unsafe {
        // Read session input independently of foreground-process permissions. AFK
        // remains detectable even if the foreground window cannot be inspected.
        let mut info = LastInputInfo {
            size: std::mem::size_of::<LastInputInfo>() as u32,
            time: 0,
        };
        if GetLastInputInfo(&mut info) == 0 {
            return None;
        }
        let idle_seconds = GetTickCount().wrapping_sub(info.time) as u64 / 1000;
        if idle_seconds >= idle_threshold {
            return Some(WindowObservation {
                app: String::new(),
                title: String::new(),
                idle_seconds,
                locked: false,
            });
        }
        let window = GetForegroundWindow();
        if window.is_null() {
            return None;
        }
        let mut process_id = 0;
        GetWindowThreadProcessId(window, &mut process_id);
        let process = OpenProcess(0x1000, 0, process_id); // PROCESS_QUERY_LIMITED_INFORMATION
        if process.is_null() {
            return None;
        }
        let mut name = vec![0u16; 32768];
        let mut len = name.len() as u32;
        let ok = QueryFullProcessImageNameW(process, 0, name.as_mut_ptr(), &mut len);
        CloseHandle(process);
        if ok == 0 {
            return None;
        }
        let path = String::from_utf16_lossy(&name[..len as usize]);
        let app = path.rsplit('\\').next().unwrap_or("").to_lowercase();
        let mut title = [0u16; 4096];
        let count = GetWindowTextW(window, title.as_mut_ptr(), title.len() as i32).max(0) as usize;
        Some(WindowObservation {
            app,
            title: String::from_utf16_lossy(&title[..count]),
            idle_seconds,
            locked: false,
        })
    }
}
unsafe extern "system" fn session_window(
    window: Handle,
    message: u32,
    wparam: usize,
    lparam: isize,
) -> isize {
    match message {
        0x02B1 => {
            if wparam == 7 {
                LOCKED.store(true, Ordering::Relaxed);
            } else if wparam == 8 {
                LOCKED.store(false, Ordering::Relaxed);
            }
        }
        0x0218 => {
            if wparam == 4 {
                SUSPENDED.store(true, Ordering::Relaxed);
            } else if wparam == 0x12 || wparam == 7 {
                SUSPENDED.store(false, Ordering::Relaxed);
            }
        }
        _ => {}
    }
    DefWindowProcW(window, message, wparam, lparam)
}
pub fn watch_session() {
    std::thread::spawn(|| unsafe {
        // Initial lock state is checked by polling; notifications cover transitions.
        let name: Vec<u16> = "TempoSessionObserver\0".encode_utf16().collect();
        let instance = GetModuleHandleW(ptr::null());
        let class = WindowClass {
            style: 0,
            wnd_proc: Some(session_window),
            cls_extra: 0,
            wnd_extra: 0,
            instance,
            icon: ptr::null_mut(),
            cursor: ptr::null_mut(),
            background: ptr::null_mut(),
            menu: ptr::null(),
            name: name.as_ptr(),
        };
        if RegisterClassW(&class) == 0 {
            return;
        }
        let window = CreateWindowExW(
            0,
            name.as_ptr(),
            name.as_ptr(),
            0,
            0,
            0,
            0,
            0,
            ptr::null_mut(),
            ptr::null_mut(),
            instance,
            ptr::null_mut(),
        );
        if window.is_null() {
            return;
        }
        WTSRegisterSessionNotification(window, 0); // NOTIFY_FOR_THIS_SESSION
        let mut message: Message = std::mem::zeroed();
        while GetMessageW(&mut message, ptr::null_mut(), 0, 0) > 0 {
            TranslateMessage(&message);
            DispatchMessageW(&message);
        }
    });
}
/// Plays a generated PCM wave so volume does not require changing the system mixer.
pub fn alarm(sound: &str, volume: u32) {
    if sound == "none" || volume == 0 {
        return;
    }
    let frequencies: &[f64] = if sound == "bell" {
        &[659., 523., 659., 523.]
    } else {
        &[523., 659., 784.]
    };
    let rate: u32 = 22050;
    let samples_per_note = (rate as f64 * 0.3) as u32;
    let sample_count = samples_per_note * frequencies.len() as u32;
    let data_size = sample_count * 2;
    let mut wave = Vec::with_capacity(data_size as usize + 44);
    wave.extend_from_slice(b"RIFF");
    wave.extend_from_slice(&(36 + data_size).to_le_bytes());
    wave.extend_from_slice(b"WAVEfmt ");
    wave.extend_from_slice(&16u32.to_le_bytes());
    wave.extend_from_slice(&1u16.to_le_bytes());
    wave.extend_from_slice(&1u16.to_le_bytes());
    wave.extend_from_slice(&rate.to_le_bytes());
    wave.extend_from_slice(&(rate * 2).to_le_bytes());
    wave.extend_from_slice(&2u16.to_le_bytes());
    wave.extend_from_slice(&16u16.to_le_bytes());
    wave.extend_from_slice(b"data");
    wave.extend_from_slice(&data_size.to_le_bytes());
    for frequency in frequencies {
        for i in 0..samples_per_note {
            let t = i as f64 / rate as f64;
            let fade = (t / 0.02).min(1.) * ((0.3 - t) / 0.15).clamp(0., 1.);
            let sample = ((t * frequency * std::f64::consts::TAU).sin()
                * fade
                * (volume.min(100) as f64 / 100.)
                * 10000.) as i16;
            wave.extend_from_slice(&sample.to_le_bytes());
        }
    }
    unsafe {
        PlaySoundW(wave.as_ptr().cast(), ptr::null_mut(), 0x0004 | 0x0002);
    } // SND_MEMORY | SND_NODEFAULT, synchronous
}
