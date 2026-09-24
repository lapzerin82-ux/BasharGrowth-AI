package com.bashar.growthchart.core

import com.bashar.growthchart.core.backup.BackupCodec
import com.bashar.growthchart.core.chart.ChartMath
import com.bashar.growthchart.core.chart.Viewport
import com.bashar.growthchart.core.model.BackupContents
import com.bashar.growthchart.core.model.MeasurementRecord
import com.bashar.growthchart.core.model.PatientRecord
import com.bashar.growthchart.core.security.PasswordVerifier
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Assert.fail
import org.junit.Test

class BackupAndChartTest {

    private val sample = BackupContents(
        createdAt = 1_700_000_000_000,
        appVersion = "test",
        patients = listOf(PatientRecord(id = "p1", name = "Test Child", sex = "F", fileNumber = "A-12", dobEpochDay = 17600, mphCm = 163.5, notes = "note")),
        measurements = listOf(MeasurementRecord(id = "m1", patientId = "p1", dateEpochDay = 20000, heightCm = 121.7, weightKg = 24.3)),
    )

    @Test
    fun backupRoundTrip() {
        val bytes = BackupCodec.encode(sample, "correct horse".toCharArray(), iterations = 20_000)
        assertFalse(String(bytes, Charsets.ISO_8859_1).contains("Test Child"))
        val back = BackupCodec.decode(bytes, "correct horse".toCharArray())
        assertEquals(sample, back)
    }

    @Test
    fun backupWrongPassword() {
        val bytes = BackupCodec.encode(sample, "a".toCharArray(), iterations = 20_000)
        try {
            BackupCodec.decode(bytes, "b".toCharArray())
            fail()
        } catch (e: BackupCodec.WrongPasswordException) {
        }
    }

    @Test
    fun backupTamperDetected() {
        val bytes = BackupCodec.encode(sample, "a".toCharArray(), iterations = 20_000)
        bytes[bytes.size - 5] = (bytes[bytes.size - 5].toInt() xor 1).toByte()
        try {
            BackupCodec.decode(bytes, "a".toCharArray())
            fail()
        } catch (e: BackupCodec.WrongPasswordException) {
        }
    }

    @Test
    fun passwordVerifier() {
        val v = PasswordVerifier.create("secret".toCharArray())
        assertTrue(v.matches("secret".toCharArray()))
        assertFalse(v.matches("Secret".toCharArray()))
    }

    @Test
    fun viewportZoomKeepsFocusAndBounds() {
        val b = Viewport(24.0, 240.0, 70.0, 200.0)
        val z = b.zoom(2.0, 100.0, 120.0, b)
        assertEquals(108.0, z.width, 1e-9)
        assertEquals(65.0, z.height, 1e-9)
        // focus point keeps its relative position
        assertEquals((100.0 - b.xMin) / b.width, (100.0 - z.xMin) / z.width, 1e-9)
        val out = b.zoom(0.1, 100.0, 120.0, b)
        assertEquals(b, out)
        val panned = z.pan(1000.0, 0.0, b)
        assertEquals(240.0, panned.xMax, 1e-9)
    }

    @Test
    fun niceTicks() {
        assertEquals(10.0, ChartMath.niceStep(130.0, 13), 1e-9)
        assertEquals(listOf(70.0, 80.0, 90.0), ChartMath.ticks(65.0, 95.0, 10.0))
    }
}
