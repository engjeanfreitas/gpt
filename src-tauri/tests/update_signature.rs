use base64::{engine::general_purpose::STANDARD, Engine};
use minisign_verify::{PublicKey, Signature};
use std::path::PathBuf;

fn artifact() -> (PublicKey, Signature, Vec<u8>, serde_json::Value) {
    let root = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .unwrap()
        .to_owned();
    let version = env!("CARGO_PKG_VERSION");
    let config: serde_json::Value =
        serde_json::from_slice(&std::fs::read(root.join("src-tauri/tauri.conf.json")).unwrap())
            .unwrap();
    assert_eq!(config["plugins"]["updater"]["requireSignedVersion"], true);
    let public = STANDARD
        .decode(config["plugins"]["updater"]["pubkey"].as_str().unwrap())
        .unwrap();
    let public = PublicKey::decode(std::str::from_utf8(&public).unwrap()).unwrap();
    let directory = root.join(format!("downloads/v{version}"));
    let manifest: serde_json::Value =
        serde_json::from_slice(&std::fs::read(directory.join("latest.json")).unwrap()).unwrap();
    let signature = STANDARD
        .decode(
            manifest["platforms"]["windows-x86_64"]["signature"]
                .as_str()
                .unwrap(),
        )
        .unwrap();
    let signature = Signature::decode(std::str::from_utf8(&signature).unwrap()).unwrap();
    assert_eq!(manifest["version"], version);
    let file = format!("Tempo-{version}-windows-x64-setup.exe");
    assert_eq!(
        manifest["platforms"]["windows-x86_64"]["url"],
        format!("https://github.com/engjeanfreitas/gpt/releases/download/v{version}/{file}")
    );
    (
        public,
        signature,
        std::fs::read(directory.join(file)).unwrap(),
        manifest,
    )
}

#[test]
fn published_installer_matches_pinned_key_and_signed_version() {
    let (public, signature, bytes, manifest) = artifact();
    public.verify(&bytes, &signature, true).unwrap();
    let signed = signature
        .trusted_comment()
        .split('\t')
        .find_map(|field| field.strip_prefix("version:"))
        .unwrap();
    assert_eq!(signed, manifest["version"].as_str().unwrap());
}

#[test]
fn modified_installer_is_rejected() {
    let (public, signature, mut bytes, _) = artifact();
    let index = bytes.len() / 2;
    bytes[index] ^= 1;
    assert!(public.verify(&bytes, &signature, true).is_err());
}
