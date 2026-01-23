//! Cryptographic utilities for password hashing and config encryption.
//! Uses Argon2id for password hashing and AES-256-GCM for encryption.

use aes_gcm::{
    aead::{Aead, KeyInit, OsRng},
    Aes256Gcm, Nonce,
};
use argon2::{
    password_hash::{rand_core::RngCore, PasswordHash, PasswordHasher, PasswordVerifier, SaltString},
    Argon2, Params,
};
use sha2::{Digest, Sha256};
use thiserror::Error;
use zeroize::Zeroizing;

/// Errors that can occur during cryptographic operations
#[derive(Error, Debug)]
pub enum CryptoError {
    #[error("Password hashing failed: {0}")]
    HashingFailed(String),
    #[error("Password verification failed")]
    VerificationFailed,
    #[error("Encryption failed: {0}")]
    EncryptionFailed(String),
    #[error("Decryption failed: {0}")]
    DecryptionFailed(String),
    #[error("Invalid key length")]
    InvalidKeyLength,
}

/// Configuration for Argon2id password hashing
/// Using OWASP recommended parameters: m=19MiB, t=2, p=1
const ARGON2_MEMORY_COST: u32 = 19 * 1024; // 19 MiB
const ARGON2_TIME_COST: u32 = 2;
const ARGON2_PARALLELISM: u32 = 1;
const ARGON2_OUTPUT_LEN: usize = 32;

/// Nonce size for AES-256-GCM (96 bits)
const NONCE_SIZE: usize = 12;

/// Hash a password using Argon2id with OWASP recommended parameters
pub fn hash_password(password: &str) -> Result<String, CryptoError> {
    let salt = SaltString::generate(&mut OsRng);

    let params = Params::new(
        ARGON2_MEMORY_COST,
        ARGON2_TIME_COST,
        ARGON2_PARALLELISM,
        Some(ARGON2_OUTPUT_LEN),
    )
    .map_err(|e| CryptoError::HashingFailed(e.to_string()))?;

    let argon2 = Argon2::new(argon2::Algorithm::Argon2id, argon2::Version::V0x13, params);

    let password_hash = argon2
        .hash_password(password.as_bytes(), &salt)
        .map_err(|e| CryptoError::HashingFailed(e.to_string()))?;

    Ok(password_hash.to_string())
}

/// Verify a password against a stored hash
pub fn verify_password(password: &str, hash: &str) -> Result<bool, CryptoError> {
    let parsed_hash = PasswordHash::new(hash)
        .map_err(|e| CryptoError::HashingFailed(e.to_string()))?;

    let params = Params::new(
        ARGON2_MEMORY_COST,
        ARGON2_TIME_COST,
        ARGON2_PARALLELISM,
        Some(ARGON2_OUTPUT_LEN),
    )
    .map_err(|e| CryptoError::HashingFailed(e.to_string()))?;

    let argon2 = Argon2::new(argon2::Algorithm::Argon2id, argon2::Version::V0x13, params);

    match argon2.verify_password(password.as_bytes(), &parsed_hash) {
        Ok(()) => Ok(true),
        Err(argon2::password_hash::Error::Password) => Ok(false),
        Err(e) => Err(CryptoError::HashingFailed(e.to_string())),
    }
}

/// Derive an encryption key from a machine-specific identifier
/// This ensures the config can only be decrypted on the same machine
pub fn derive_key(machine_id: &str, secret: &str) -> Zeroizing<[u8; 32]> {
    let mut hasher = Sha256::new();
    hasher.update(machine_id.as_bytes());
    hasher.update(secret.as_bytes());
    hasher.update(b"gameblocker-config-key-v1");

    let result = hasher.finalize();
    let mut key = Zeroizing::new([0u8; 32]);
    key.copy_from_slice(&result);
    key
}

/// Encrypt data using AES-256-GCM
pub fn encrypt(data: &[u8], key: &[u8; 32]) -> Result<Vec<u8>, CryptoError> {
    let cipher = Aes256Gcm::new_from_slice(key)
        .map_err(|_| CryptoError::InvalidKeyLength)?;

    // Generate random nonce
    let mut nonce_bytes = [0u8; NONCE_SIZE];
    OsRng.fill_bytes(&mut nonce_bytes);
    let nonce = Nonce::from_slice(&nonce_bytes);

    let ciphertext = cipher
        .encrypt(nonce, data)
        .map_err(|e| CryptoError::EncryptionFailed(e.to_string()))?;

    // Prepend nonce to ciphertext
    let mut result = Vec::with_capacity(NONCE_SIZE + ciphertext.len());
    result.extend_from_slice(&nonce_bytes);
    result.extend_from_slice(&ciphertext);

    Ok(result)
}

/// Decrypt data using AES-256-GCM
pub fn decrypt(encrypted_data: &[u8], key: &[u8; 32]) -> Result<Vec<u8>, CryptoError> {
    if encrypted_data.len() < NONCE_SIZE {
        return Err(CryptoError::DecryptionFailed("Data too short".to_string()));
    }

    let cipher = Aes256Gcm::new_from_slice(key)
        .map_err(|_| CryptoError::InvalidKeyLength)?;

    let (nonce_bytes, ciphertext) = encrypted_data.split_at(NONCE_SIZE);
    let nonce = Nonce::from_slice(nonce_bytes);

    cipher
        .decrypt(nonce, ciphertext)
        .map_err(|e| CryptoError::DecryptionFailed(e.to_string()))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_password_hash_and_verify() {
        let password = "test_password_123!";
        let hash = hash_password(password).expect("Hashing should succeed");

        assert!(verify_password(password, &hash).expect("Verification should succeed"));
        assert!(!verify_password("wrong_password", &hash).expect("Verification should succeed"));
    }

    #[test]
    fn test_encrypt_decrypt() {
        let key = derive_key("test-machine-id", "test-secret");
        let data = b"Hello, World! This is sensitive data.";

        let encrypted = encrypt(data, &key).expect("Encryption should succeed");
        let decrypted = decrypt(&encrypted, &key).expect("Decryption should succeed");

        assert_eq!(data.as_slice(), decrypted.as_slice());
    }

    #[test]
    fn test_encrypt_produces_different_ciphertext() {
        let key = derive_key("test-machine-id", "test-secret");
        let data = b"Same data";

        let encrypted1 = encrypt(data, &key).expect("Encryption should succeed");
        let encrypted2 = encrypt(data, &key).expect("Encryption should succeed");

        // Different nonces should produce different ciphertext
        assert_ne!(encrypted1, encrypted2);
    }
}
