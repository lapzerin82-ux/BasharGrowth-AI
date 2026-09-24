package com.bashar.growthchart.ui.components

import android.content.Context
import android.content.Intent
import androidx.core.content.FileProvider
import java.io.File

/** Directory for temporary share files; its contents are removed before each new export. */
fun exportDir(context: Context): File = File(context.cacheDir, "exports").apply {
    mkdirs()
    listFiles()?.forEach { it.delete() }
}

fun shareFile(context: Context, file: File, mime: String, title: String) {
    val uri = FileProvider.getUriForFile(context, "${context.packageName}.fileprovider", file)
    val send = Intent(Intent.ACTION_SEND).apply {
        type = mime
        putExtra(Intent.EXTRA_STREAM, uri)
        putExtra(Intent.EXTRA_SUBJECT, title)
        addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
    }
    context.startActivity(Intent.createChooser(send, title).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
}

fun safeFileName(s: String): String = s.replace(Regex("[^A-Za-z0-9._-]+"), "_").trim('_').ifEmpty { "patient" }.take(60)
