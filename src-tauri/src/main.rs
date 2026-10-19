#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    tempo_core::desktop::run();
}
