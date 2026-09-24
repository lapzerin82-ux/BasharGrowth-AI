package com.bashar.growthchart.data

import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

/**
 * Wraps secrets (database keys, cloud data keys) with a non-exportable AES-256 key
 * held in the Android Keystore (hardware-backed where available).
 */
object KeyWrapper {
    private const val ALIAS = "growthchart_master_v1"
    private const val PROVIDER = "AndroidKeyStore"

    private fun masterKey(): SecretKey {
        val ks = KeyStore.getInstance(PROVIDER).apply { load(null) }
        (ks.getEntry(ALIAS, null) as? KeyStore.SecretKeyEntry)?.let { return it.secretKey }
        val gen = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, PROVIDER)
        gen.init(
            KeyGenParameterSpec.Builder(ALIAS, KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT)
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                .setKeySize(256)
                .build()
        )
        return gen.generateKey()
    }

    fun wrap(secret: ByteArray): String {
        val c = Cipher.getInstance("AES/GCM/NoPadding")
        c.init(Cipher.ENCRYPT_MODE, masterKey())
        val out = c.iv + c.doFinal(secret)
        return Base64.encodeToString(out, Base64.NO_WRAP)
    }

    fun unwrap(wrapped: String): ByteArray {
        val data = Base64.decode(wrapped, Base64.NO_WRAP)
        val c = Cipher.getInstance("AES/GCM/NoPadding")
        c.init(Cipher.DECRYPT_MODE, masterKey(), GCMParameterSpec(128, data, 0, 12))
        return c.doFinal(data, 12, data.size - 12)
    }
}
