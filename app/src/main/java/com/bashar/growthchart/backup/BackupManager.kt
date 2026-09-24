package com.bashar.growthchart.backup

import android.content.Context
import android.net.Uri
import com.bashar.growthchart.BuildConfig
import com.bashar.growthchart.core.backup.BackupCodec
import com.bashar.growthchart.core.model.BackupContents
import com.bashar.growthchart.data.PatientRepository
import com.bashar.growthchart.data.RestoreReport
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.File

object BackupManager {
    const val EXTENSION = "bgcbackup"
    const val MIME = "application/octet-stream"

    suspend fun createBytes(repo: PatientRepository, account: String, password: CharArray): Pair<ByteArray, BackupContents> =
        withContext(Dispatchers.Default) {
            val contents = repo.exportAll(BuildConfig.VERSION_NAME, account)
            BackupCodec.encode(contents, password) to contents
        }

    suspend fun writeTo(context: Context, uri: Uri, bytes: ByteArray) = withContext(Dispatchers.IO) {
        context.contentResolver.openOutputStream(uri, "wt")!!.use { it.write(bytes) }
    }

    suspend fun writeTo(file: File, bytes: ByteArray) = withContext(Dispatchers.IO) { file.writeBytes(bytes) }

    suspend fun read(context: Context, uri: Uri): ByteArray = withContext(Dispatchers.IO) {
        context.contentResolver.openInputStream(uri)!!.use { it.readBytes() }
    }

    suspend fun decode(bytes: ByteArray, password: CharArray): BackupContents =
        withContext(Dispatchers.Default) { BackupCodec.decode(bytes, password) }

    suspend fun restore(repo: PatientRepository, contents: BackupContents, replace: Boolean): RestoreReport =
        repo.restore(contents, replace)
}
