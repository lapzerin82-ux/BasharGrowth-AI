package com.bashar.growthchart.core.backup

import com.bashar.growthchart.core.model.BackupContents
import com.bashar.growthchart.core.security.Crypto
import kotlinx.serialization.json.Json
import java.io.ByteArrayInputStream
import java.io.ByteArrayOutputStream
import java.nio.ByteBuffer
import java.util.zip.GZIPInputStream
import java.util.zip.GZIPOutputStream
import javax.crypto.AEADBadTagException

/**
 * Encrypted backup file format (.bgcbackup):
 *
 *   magic   "BGCB"            4 bytes
 *   version 1                 1 byte
 *   iter    PBKDF2 iterations 4 bytes big-endian
 *   salt                      16 bytes
 *   payload AES-256-GCM(iv || ciphertext || tag) of gzip(JSON BackupContents)
 *
 * The key is derived from the backup password with PBKDF2-HMAC-SHA256; the
 * header is authenticated as GCM additional data. The file can therefore be
 * restored on any device/installation that knows the backup password.
 */
object BackupCodec {
    private val MAGIC = byteArrayOf('B'.code.toByte(), 'G'.code.toByte(), 'C'.code.toByte(), 'B'.code.toByte())
    private const val VERSION: Byte = 1
    private const val HEADER_SIZE = 4 + 1 + 4 + 16

    val json = Json { ignoreUnknownKeys = true; encodeDefaults = true }

    class WrongPasswordException : Exception("Incorrect backup password or corrupted file")
    class InvalidFileException(msg: String) : Exception(msg)

    fun encode(contents: BackupContents, password: CharArray, iterations: Int = Crypto.PBKDF2_ITERATIONS): ByteArray {
        val plain = json.encodeToString(BackupContents.serializer(), contents).toByteArray(Charsets.UTF_8)
        val gz = ByteArrayOutputStream().also { bos -> GZIPOutputStream(bos).use { it.write(plain) } }.toByteArray()
        val salt = Crypto.randomBytes(16)
        val header = ByteBuffer.allocate(HEADER_SIZE).put(MAGIC).put(VERSION).putInt(iterations).put(salt).array()
        val key = Crypto.pbkdf2(password, salt, iterations)
        return header + Crypto.aesGcmEncrypt(key, gz, header)
    }

    fun decode(data: ByteArray, password: CharArray): BackupContents {
        if (data.size <= HEADER_SIZE || !data.copyOfRange(0, 4).contentEquals(MAGIC)) {
            throw InvalidFileException("Not a Pediatric Growth Chart backup file")
        }
        val buf = ByteBuffer.wrap(data)
        buf.position(4)
        val version = buf.get()
        if (version != VERSION) throw InvalidFileException("Unsupported backup version $version")
        val iterations = buf.getInt()
        if (iterations < 10_000 || iterations > 10_000_000) throw InvalidFileException("Invalid backup header")
        val salt = ByteArray(16).also { buf.get(it) }
        val header = data.copyOfRange(0, HEADER_SIZE)
        val key = Crypto.pbkdf2(password, salt, iterations)
        val gz = try {
            Crypto.aesGcmDecrypt(key, data.copyOfRange(HEADER_SIZE, data.size), header)
        } catch (e: AEADBadTagException) {
            throw WrongPasswordException()
        }
        val plain = GZIPInputStream(ByteArrayInputStream(gz)).use { it.readBytes() }
        return json.decodeFromString(BackupContents.serializer(), plain.toString(Charsets.UTF_8))
    }
}
