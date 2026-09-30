/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
import { describe, expect, test } from 'vitest'

import { toIntlLocale } from '@/i18n/languages'

import { formatCacheHitRatio } from '../format'

describe('formatCacheHitRatio', () => {
  test('returns null when cache or prompt tokens are missing', () => {
    expect(formatCacheHitRatio(0, 100)).toBeNull()
    expect(formatCacheHitRatio(50, 0)).toBeNull()
    expect(formatCacheHitRatio(Number.NaN, 100)).toBeNull()
  })

  test('formats cache read over prompt tokens as a percent', () => {
    expect(formatCacheHitRatio(49792, 50207, 'en-US')).toBe('99.2%')
    expect(formatCacheHitRatio(300, 1200, 'en-US')).toBe('25%')
  })

  test('clamps ratios above 100%', () => {
    expect(formatCacheHitRatio(1500, 1000, 'en-US')).toBe('100%')
  })

  test('accepts each interface language through toIntlLocale', () => {
    for (const language of [
      'zhCN',
      'zhTW',
      'en',
      'fr',
      'ru',
      'ja',
      'vi',
      'not-a-real-language',
    ]) {
      const formatted = formatCacheHitRatio(
        49792,
        50207,
        toIntlLocale(language)
      )
      expect(formatted).toMatch(/99/)
      expect(formatted).toMatch(/%|％|﹪/)
    }
  })
})
