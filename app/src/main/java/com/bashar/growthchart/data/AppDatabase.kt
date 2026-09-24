package com.bashar.growthchart.data

import android.content.Context
import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase
import net.zetetic.database.sqlcipher.SupportOpenHelperFactory

@Database(entities = [PatientEntity::class, MeasurementEntity::class], version = 1, exportSchema = false)
abstract class AppDatabase : RoomDatabase() {
    abstract fun patients(): PatientDao
    abstract fun measurements(): MeasurementDao

    companion object {
        @Volatile
        private var libraryLoaded = false

        /**
         * Opens (or creates) the SQLCipher-encrypted database of one clinician account.
         * Each account has its own database file and its own random 256-bit key.
         */
        fun open(context: Context, fileName: String, key: ByteArray): AppDatabase {
            if (!libraryLoaded) {
                System.loadLibrary("sqlcipher")
                libraryLoaded = true
            }
            return Room.databaseBuilder(context.applicationContext, AppDatabase::class.java, fileName)
                .openHelperFactory(SupportOpenHelperFactory(key))
                .build()
        }
    }
}
