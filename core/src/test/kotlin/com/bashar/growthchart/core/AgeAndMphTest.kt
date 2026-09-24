package com.bashar.growthchart.core

import com.bashar.growthchart.core.growth.AgeCalculator
import com.bashar.growthchart.core.growth.MidParentalHeight
import com.bashar.growthchart.core.growth.Sex
import org.junit.Assert.assertEquals
import org.junit.Test
import java.time.LocalDate

class AgeAndMphTest {

    @Test
    fun exampleFromSpecification() {
        // DOB 15/03/2018, measured 24/09/2026
        val age = AgeCalculator.exactAge(LocalDate.of(2018, 3, 15), LocalDate.of(2026, 9, 24))
        assertEquals(3115L, age.days)
        assertEquals("8 y 6 m 9 d", age.format())
        assertEquals(3115 / 30.4375, age.months, 1e-12)
        assertEquals(8.528405, age.years, 1e-6)
    }

    @Test
    fun ageIsNotRounded() {
        val dob = LocalDate.of(2020, 1, 1)
        val a1 = AgeCalculator.exactAge(dob, LocalDate.of(2027, 5, 1)).months
        val a2 = AgeCalculator.exactAge(dob, LocalDate.of(2027, 5, 2)).months
        assertEquals(1.0 / 30.4375, a2 - a1, 1e-12)
    }

    @Test
    fun midParentalHeight() {
        assertEquals(176.5, MidParentalHeight.calculate(Sex.MALE, 180.0, 160.0), 1e-9)
        assertEquals(163.5, MidParentalHeight.calculate(Sex.FEMALE, 180.0, 160.0), 1e-9)
        val r = MidParentalHeight.targetRange(176.5)
        assertEquals(168.0, r.start, 1e-9)
        assertEquals(185.0, r.endInclusive, 1e-9)
    }
}
