package com.bashar.growthchart.core.security

import java.security.MessageDigest
import java.security.SecureRandom
import javax.crypto.Cipher
import javax.crypto.SecretKeyFactory
import javax.crypto.spec.GCMParameterSpec
import javax.crypto.spec.PBEKeySpec
import javax.crypto.spec.SecretKeySpec

object Crypto {
    private val random = SecureRandom()

    const val PBKDF2_ITERATIONS = 210_000
    private const val GCM_IV_BYTES = 12
    private const val GCM_TAG_BITS = 128

    fun randomBytes(n: Int): ByteArray = ByteArray(n).also { random.nextBytes(it) }

    /** PBKDF2-HMAC-SHA256 key derivation. */
    fun pbkdf2(password: CharArray, salt: ByteArray, iterations: Int = PBKDF2_ITERATIONS, keyBytes: Int = 32): ByteArray {
        val spec = PBEKeySpec(password, salt, iterations, keyBytes * 8)
        try {
            return SecretKeyFactory.getInstance("PBKDF2WithHmacSHA256").generateSecret(spec).encoded
        } finally {
            spec.clearPassword()
        }
    }

    fun constantTimeEquals(a: ByteArray, b: ByteArray): Boolean = MessageDigest.isEqual(a, b)

    fun sha256(data: ByteArray): ByteArray = MessageDigest.getInstance("SHA-256").digest(data)

    /** AES-256-GCM. Output = iv || ciphertext+tag. */
    fun aesGcmEncrypt(key: ByteArray, plaintext: ByteArray, aad: ByteArray? = null): ByteArray {
        val iv = randomBytes(GCM_IV_BYTES)
        val c = Cipher.getInstance("AES/GCM/NoPadding")
        c.init(Cipher.ENCRYPT_MODE, SecretKeySpec(key, "AES"), GCMParameterSpec(GCM_TAG_BITS, iv))
        if (aad != null) c.updateAAD(aad)
        return iv + c.doFinal(plaintext)
    }

    fun aesGcmDecrypt(key: ByteArray, data: ByteArray, aad: ByteArray? = null): ByteArray {
        require(data.size > GCM_IV_BYTES) { "ciphertext too short" }
        val c = Cipher.getInstance("AES/GCM/NoPadding")
        c.init(Cipher.DECRYPT_MODE, SecretKeySpec(key, "AES"), GCMParameterSpec(GCM_TAG_BITS, data, 0, GCM_IV_BYTES))
        if (aad != null) c.updateAAD(aad)
        return c.doFinal(data, GCM_IV_BYTES, data.size - GCM_IV_BYTES)
    }
}

/** Salted PBKDF2 password verifier. The password itself is never stored. */
data class PasswordVerifier(val salt: ByteArray, val iterations: Int, val hash: ByteArray) {

    fun matches(password: CharArray): Boolean =
        Crypto.constantTimeEquals(Crypto.pbkdf2(password, salt, iterations), hash)

    companion object {
        fun create(password: CharArray): PasswordVerifier {
            val salt = Crypto.randomBytes(16)
            return PasswordVerifier(salt, Crypto.PBKDF2_ITERATIONS, Crypto.pbkdf2(password, salt))
        }
    }
}
