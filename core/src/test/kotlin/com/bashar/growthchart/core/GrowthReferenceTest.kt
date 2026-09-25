package com.bashar.growthchart.core

import com.bashar.growthchart.core.growth.GrowthReferences
import com.bashar.growthchart.core.growth.Measure
import com.bashar.growthchart.core.growth.Normal
import com.bashar.growthchart.core.growth.Sex
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class GrowthReferenceTest {

    @Test
    fun normalDistributionMatchesTables() {
        assertEquals(0.5, Normal.cdf(0.0), 1e-12)
        assertEquals(0.9750021048517795, Normal.cdf(1.96), 1e-10)
        assertEquals(0.022750131948179, Normal.cdf(-2.0), 1e-10)
        assertEquals(-1.880793608151, Normal.inverseCdf(0.03), 1e-9)
        assertEquals(1.880793608151, Normal.inverseCdf(0.97), 1e-9)
        assertEquals(-1.281551565545, Normal.inverseCdf(0.10), 1e-9)
        assertEquals(-1.036433389494, Normal.inverseCdf(0.15), 1e-9)
    }

    @Test
    fun allReferencesLoad() {
        val refs = GrowthReferences.all()
        assertEquals(5, refs.size)
        refs.forEach { r ->
            Measure.entries.forEach { m ->
                val mr = r.measure(m)
                assertNotNull("${r.id} ${m.key}", mr)
                Sex.entries.forEach { s ->
                    val t = mr!!.table(s)
                    assertTrue("${r.id} ${m.key} ${s} min", t.minAge <= mr.ageMin + 1e-6)
                    assertTrue("${r.id} ${m.key} ${s} max", t.maxAge >= mr.ageMax - 1e-6)
                }
            }
        }
    }

    // Published LMS medians (official tables)

    @Test
    fun who2006PublishedValues() {
        val who = GrowthReferences.get(GrowthReferences.WHO_2006)
        // WHO lhfa boys, day 0: M = 49.8842 ; wfa boys day 0: M = 3.3464
        assertEquals(49.8842, who.measure(Measure.HEIGHT)!!.lms(Sex.MALE, 0.0)!!.m, 1e-6)
        assertEquals(3.3464, who.measure(Measure.WEIGHT)!!.lms(Sex.MALE, 0.0)!!.m, 1e-6)
        // WHO lhfa girls day 0: M = 49.1477
        assertEquals(49.1477, who.measure(Measure.HEIGHT)!!.lms(Sex.FEMALE, 0.0)!!.m, 1e-6)
        // WHO wfa boys at 12 months (day 365): M ~ 9.6479 (monthly table)
        assertEquals(9.6479, who.measure(Measure.WEIGHT)!!.lms(Sex.MALE, 12.0)!!.m, 0.005)
        // WHO lhfa boys 60 months (monthly table): M = 110.0 cm
        assertEquals(110.0, who.measure(Measure.HEIGHT)!!.lms(Sex.MALE, 60.0)!!.m, 0.05)
    }

    @Test
    fun cdcPublishedValues() {
        val child = GrowthReferences.get(GrowthReferences.CDC_CHILD)
        // statage.csv boys Agemos 24: L=0.941523967 M=86.45220101 S=0.040321528
        val p = child.measure(Measure.HEIGHT)!!.lms(Sex.MALE, 24.0)!!
        assertEquals(0.941523967, p.l, 1e-9)
        assertEquals(86.45220101, p.m, 1e-8)
        assertEquals(0.040321528, p.s, 1e-9)
        // boys Agemos 240: M = 176.8492322
        assertEquals(176.8492322, child.measure(Measure.HEIGHT)!!.lms(Sex.MALE, 240.0)!!.m, 1e-6)
        val inf = GrowthReferences.get(GrowthReferences.CDC_INFANT)
        // lenageinf boys Agemos 0: M = 49.98888408
        assertEquals(49.98888408, inf.measure(Measure.HEIGHT)!!.lms(Sex.MALE, 0.0)!!.m, 1e-8)
        // wtageinf girls Agemos 0: M = 3.39918645
        assertEquals(3.39918645, inf.measure(Measure.WEIGHT)!!.lms(Sex.FEMALE, 0.0)!!.m, 1e-8)
    }

    @Test
    fun medianHasZeroZAndCentileRoundTrips() {
        GrowthReferences.all().forEach { r ->
            r.measures.values.forEach { m ->
                val age = (m.ageMin + m.ageMax) / 2
                Sex.entries.forEach { s ->
                    val med = m.centileValue(s, age, 50.0)!!
                    assertEquals(0.0, m.assess(s, age, med)!!.z, 1e-9)
                    r.centiles.forEach { c ->
                        val v = m.centileValue(s, age, c)!!
                        assertEquals("${r.id} $c", c, m.assess(s, age, v)!!.percentile, 1e-6)
                    }
                }
            }
        }
    }

    @Test
    fun interpolationIsBetweenNeighbours() {
        val h = GrowthReferences.get(GrowthReferences.CDC_CHILD).measure(Measure.HEIGHT)!!
        val a = h.lms(Sex.MALE, 102.5)!!.m
        val b = h.lms(Sex.MALE, 103.5)!!.m
        val mid = h.lms(Sex.MALE, 103.0)!!.m
        assertEquals((a + b) / 2, mid, 1e-9)
    }

    @Test
    fun outsideChartAgeReturnsNull() {
        val h = GrowthReferences.get(GrowthReferences.CDC_CHILD).measure(Measure.HEIGHT)!!
        assertNull(h.lms(Sex.MALE, 12.0))
        assertNull(h.lms(Sex.MALE, 241.0))
        val w7 = GrowthReferences.get(GrowthReferences.WHO_2007).measure(Measure.WEIGHT)!!
        assertNull(w7.lms(Sex.FEMALE, 121.0))
    }

    @Test
    fun whoRestrictedTailsForWeight() {
        val w = GrowthReferences.get(GrowthReferences.WHO_2006).measure(Measure.WEIGHT)!!
        val p = w.lms(Sex.MALE, 24.0)!!
        val sd3 = p.valueAt(3.0)
        val sd2 = p.valueAt(2.0)
        val x = sd3 + (sd3 - sd2) // exactly +4 SD under the WHO restricted method
        assertEquals(4.0, w.assess(Sex.MALE, 24.0, x)!!.z, 1e-9)
    }

    @Test
    fun automaticWhoToCdcSwitchAt24Months() {
        assertEquals(GrowthReferences.WHO_0_2, GrowthReferences.defaultFor(GrowthReferences.Family.AUTO, 0.0))
        assertEquals(GrowthReferences.WHO_0_2, GrowthReferences.defaultFor(GrowthReferences.Family.AUTO, 23.99))
        assertEquals(GrowthReferences.CDC_CHILD, GrowthReferences.defaultFor(GrowthReferences.Family.AUTO, 24.0))
        val w = GrowthReferences.get(GrowthReferences.WHO_0_2)
        assertEquals(listOf(2.0, 5.0, 10.0, 25.0, 50.0, 75.0, 90.0, 95.0, 98.0), w.centiles)
        // same LMS as the full WHO 2006 table
        val full = GrowthReferences.get(GrowthReferences.WHO_2006)
        assertEquals(full.measure(Measure.HEIGHT)!!.lms(Sex.FEMALE, 13.37)!!.m, w.measure(Measure.HEIGHT)!!.lms(Sex.FEMALE, 13.37)!!.m, 1e-12)
        assertNull(w.measure(Measure.WEIGHT)!!.lms(Sex.MALE, 25.0))
    }

    @Test
    fun defaultChartSelection() {
        assertEquals(GrowthReferences.CDC_INFANT, GrowthReferences.defaultFor(GrowthReferences.Family.CDC, 23.9))
        assertEquals(GrowthReferences.CDC_CHILD, GrowthReferences.defaultFor(GrowthReferences.Family.CDC, 24.0))
        assertEquals(GrowthReferences.WHO_2006, GrowthReferences.defaultFor(GrowthReferences.Family.WHO, 59.0))
        assertEquals(GrowthReferences.WHO_2007, GrowthReferences.defaultFor(GrowthReferences.Family.WHO, 60.0))
    }
}
