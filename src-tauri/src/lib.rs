#[cfg(feature = "desktop")]
pub mod desktop;
pub mod model;
pub mod store;
#[cfg(feature = "desktop")]
mod updates;
#[cfg(windows)]
pub mod windows;
