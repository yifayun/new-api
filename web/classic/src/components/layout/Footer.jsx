/*
Copyright (C) 2025 QuantumNous

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

import React, { useEffect, useState, useMemo, useContext } from 'react';
import { useTranslation } from 'react-i18next';
import { Typography } from '@douyinfe/semi-ui';
import { Building2 } from 'lucide-react';
import { getFooterHTML, getLogo, getSystemName } from '../../helpers';
import { StatusContext } from '../../context/Status';

// Provided icons (telecom / public security / ICP)
const RECORD_ICON_TELECOM =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABIAAAAUCAYAAACAl21KAAAEqElEQVR4AWyUDWwTZRjH//f22luvX+u6dm03Oshmx0Y2phKyEBAFFkgAMRgTUaJIVJIhg2liiIFoghExxgQNGCSRaCBCDBAHJkO+5ENxDHCso1g2JrB169b143rt2rtee75tzKIJ/+RJLu/z/H/v+9xz7xE8RvLA/hbxwot7hc66bvFSaTB52RxMdHp7UhfW7Evf/mTRYyz4H0hNnLOJZ1p/SF1qu0aix9sNtsB849y429CccOvL781D7Ke2zM0PLotdrcfVB8dd/wVOg9T4mVnxs+t8TPzsy6YGIB0xYOiAA/6NTvg3ODG034H0uBHG2QAjnl0b797Qr06erse/KoKmolc8Qtcr3Xpr2MVaWQQ+d6J/qxuD39sxdUuLdB+LwcPl8G1zIbDbBWLSgq8Qy+Jn1nVnJi7WgqoIUn7vOMLmInbk2SLg3okKSBkWlQujaPpsGE17RuB5NoqszGLwlAO+zZXIS1roWNEkXXvnR8oBkR4crc+HbyzkqoHBT8sxftcE79IQSqunkLpXAjmugSIySA2UwOROw9s6hsh9HgO77OAqAXXyTrP88ODTRB3rfFPnBBJ39Rg/ZwGvl+FeFYe5IY3khA79H3nQt8MDMcjB5M3AvVqAwSghdNWMWK8B3AwgO9q1ieSIbxHnBqK/GKDQIbJsnpqrEO0xwrMqClWmhaIGntVRJPx6+HZUgTD0JGAQoR6dAyBq3wKijA1X58aBdFBHU2qhXcgCi3wWcC4ToJ8hg6+UUdEqQFUBKcEWawhUZIJaKGOAMjHhJEw8rVPzdActKAhFcZYs8mmCnm2zMPmnETG/EdfbZyEbZ1FCcyhKhcoyQMEbk7SE8LYY4QCtOU/XGDAM3SGtgcaYg71ZhK1RRFljAvYnRWgpRKE5hoCeh4A158DwoGEWieqc7VOp2Twng4LkhAYyHbNzhYj6j8fhfXcC3o4JNOwKwf2CWMwVW6fF5jkSQDtl7DUBwjlbTkoKYJ0vwupJAfo8LDOTsDRJmBrhkU1wyCZLkHrE00lKKPUmAT4HqysFW0uCgimrsuUk0T6x9kheKEtqdDk0fjmG+i0h1GwKg9XnkIsCilAIFfk4A0JyqNkYRn1bCE37QmBNCpRJPstZNhwiDDMva16y63WxF8imFdiWZfDwsB29HZX0qjgwdq4UIfp9Bb6ga+9VYehbB6zPSZBzCsSbgGXl7rcY59wUARVj3XwiY1i/t7ddh4hPh9r3wyhbPgXbIgGzO4Ko6xiFfbEA67Ip1G4PQxjSoreNg6CuOcgYt35HESiCCg/BPywX5ZgL/p0eeeQYC9fKSZQvTmL0tEUd7bSoZQtScD8fQaiTxZ3tnpwcdSDSU/FrwVuIaZDc37eeqFmQmU5/5FFzYLSzWopcMdJ3pDKKCCZy1YDQqRmZ8GDj/XyVw0foPcDw368VIIWYBvGNDTdSHFEUQany7mBLypbqGa7WkqnZkkBNuwCuziKVPmMk3p0Mzyhwa8pL8zGjrrsAKcQ0aN7RA3scb7+6XOHlv1KBmV2j1576yn/Ec+PWN0su3j7Uej5wrPb6w/P1X2cG6k7K9F/Av/HSyhW//fxhAVKIfwAAAP//aux6EQAAAAZJREFUAwBvhQOhuCWV7QAAAABJRU5ErkJggg==';
const RECORD_ICON_PUBLIC_SECURITY =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABIAAAAUCAYAAACAl21KAAAEqElEQVR4AWyUDWwTZRjH//f22luvX+u6dm03Oshmx0Y2phKyEBAFFkgAMRgTUaJIVJIhg2liiIFoghExxgQNGCSRaCBCDBAHJkO+5ENxDHCso1g2JrB169b143rt2rtee75tzKIJ/+RJLu/z/H/v+9xz7xE8RvLA/hbxwot7hc66bvFSaTB52RxMdHp7UhfW7Evf/mTRYyz4H0hNnLOJZ1p/SF1qu0aix9sNtsB849y429CccOvL781D7Ke2zM0PLotdrcfVB8dd/wVOg9T4mVnxs+t8TPzsy6YGIB0xYOiAA/6NTvg3ODG034H0uBHG2QAjnl0b797Qr06erse/KoKmolc8Qtcr3Xpr2MVaWQQ+d6J/qxuD39sxdUuLdB+LwcPl8G1zIbDbBWLSgq8Qy+Jn1nVnJi7WgqoIUn7vOMLmInbk2SLg3okKSBkWlQujaPpsGE17RuB5NoqszGLwlAO+zZXIS1roWNEkXXvnR8oBkR4crc+HbyzkqoHBT8sxftcE79IQSqunkLpXAjmugSIySA2UwOROw9s6hsh9HgO77OAqAXXyTrP88ODTRB3rfFPnBBJ39Rg/ZwGvl+FeFYe5IY3khA79H3nQt8MDMcjB5M3AvVqAwSghdNWMWK8B3AwgO9q1ieSIbxHnBqK/GKDQIbJsnpqrEO0xwrMqClWmhaIGntVRJPx6+HZUgTD0JGAQoR6dAyBq3wKijA1X58aBdFBHU2qhXcgCi3wWcC4ToJ8hg6+UUdEqQFUBKcEWawhUZIJaKGOAMjHhJEw8rVPzdActKAhFcZYs8mmCnm2zMPmnETG/EdfbZyEbZ1FCcyhKhcoyQMEbk7SE8LYY4QCtOU/XGDAM3SGtgcaYg71ZhK1RRFljAvYnRWgpRKE5hoCeh4A158DwoGEWieqc7VOp2Twng4LkhAYyHbNzhYj6j8fhfXcC3o4JNOwKwf2CWMwVW6fF5jkSQDtl7DUBwjlbTkoKYJ0vwupJAfo8LDOTsDRJmBrhkU1wyCZLkHrE00lKKPUmAT4HqysFW0uCgimrsuUk0T6x9kheKEtqdDk0fjmG+i0h1GwKg9XnkIsCilAIFfk4A0JyqNkYRn1bCE37QmBNCpRJPstZNhwiDDMva16y63WxF8imFdiWZfDwsB29HZX0qjgwdq4UIfp9Bb6ga+9VYehbB6zPSZBzCsSbgGXl7rcY59wUARVj3XwiY1i/t7ddh4hPh9r3wyhbPgXbIgGzO4Ko6xiFfbEA67Ip1G4PQxjSoreNg6CuOcgYt35HESiCCg/BPywX5ZgL/p0eeeQYC9fKSZQvTmL0tEUd7bSoZQtScD8fQaiTxZ3tnpwcdSDSU/FrwVuIaZDc37eeqFmQmU5/5FFzYLSzWopcMdJ3pDKKCCZy1YDQqRmZ8GDj/XyVw0foPcDw368VIIWYBvGNDTdSHFEUQany7mBLypbqGa7WkqnZkkBNuwCuziKVPmMk3p0Mzyhwa8pL8zGjrrsAKcQ0aN7RA3scb7+6XOHlv1KBmV2j1576yn/Ec+PWN0su3j7Uej5wrPb6w/P1X2cG6k7K9F/Av/HSyhW//fxhAVKIfwAAAP//aux6EQAAAAZJREFUAwBvhQOhuCWV7QAAAABJRU5ErkJggg==';
const RECORD_ICON_ICP =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABQAAAAUCAYAAACNiR0NAAAE5ElEQVR4AXzSCWyTZRgH8P/Xrtd6rO26o107Oo61JdugOuRwXFswQRwmglMkQDSYuREkeIJEWbwZkWgEjBE0kYGwDNGxqejYOMPw2CgrY+2udqPd0fVc76/9PjuEJiDhSZ7kfZPn/b1v3udh4CFBOy4paMPxqnNfVv7V8Plmg8tQX0UPXVI85AgeCNKOluXXTn3acHh3Tf+3tXsOdrddKHYYjEVnTzQc/Kb2E6vh+N4G2nfzqQfB/wPpwTZuU90vrTuqdqxh+0iuji1AWYYcq6QKrNUWYaGmKGXnG2+v+fnAgdNTtfej94B0oEcx7mKcOVX3G16tWIeledNh/uMiQjctiHQP4LtdH2Aak4UD73+MX386C18gpf5+NAnSkS5d+/nLg+XPVi9RKQpRmqtCf+NJzBRIQLmi4JMcTOMK0VhbC7VABr1+FZ5ev73cYHcM9BjqNXdfmgQRdgpMNwxsi3UUxfrHYTUYQY75IOTxQFIkukzXkS2TgOkKw/z7OSwoWQFjnw1tF1rlHB6Ldw/o7K1T2nuv7WPGfOClUIiFggj6aUQTVZ64H0RWCoSadAwFR8FOAWwDFkjS0xGkwgiG3JBJWPvokCEvUf5fl4e6O9e4LDdLpDw2QLAgkOVAodXCQwGK/GmYu6gYC9c/g2WrS8FOZ2Jm4WwESAaoGAtZEiG8owPLXSPml5AIRiIhZNI6yjsBVWY2oswMtHZZkDm/AMriHEwEfBi+ZYetsxN2hw0lFaVQVazCoaNN4LLkmKfRIWAzw2/vV05Zt0GKjJT7PQ7Is9JRUPgojtY34cj39SjSzweTmYpR+xiCvkmM2Ufhmwyhte4HNDafgWbWLKjlUnhsA/A7h0qSIEHR4kDQjxgVwdLFi8AgAXP7EHouWqEU5ECcQMU8AfSaORgxOHD59CWQYRfKnpiLaNgBn8cOPp9mJUFBqqhFLs9MdJTG6rJ8ZEvjMNndaB8MofkfC264CLQYbLgy6McEKxf9zijShH6ULVaBz4tBo5kOsTi1OQlSNJVJURQmHSbkZ1rx+mvLYGJQ+Hp4Al/0OnDMSuOMU4w3T3ZgW8t1XI0Bm18uxTx1GO7xPkTjJOIMYk4SZPFFxUwuD7bE55r//hHLFmTieNN+VL9ViY1bN6Fy9xZU7tqCFS88iYXlS7Bh21qsLJuB4Z5zGBu1gsFOBYPD0ybBjFn5m8TybAilIjDjEXS0nYAqtRvVzyde9YoKj822IkfWgXe2F+DIV+XYuk6NEdN5+B0jkMqywRfLwU1TVCRBQlFxLEdfvCFLpfLmzsiFSMyAsbMRVNAIn+MqAr4OsJnD4BAWRMfb0Xu9GWkCGoVzC8HhS5xS+YwynrKqNQlOLcJ+yjbhD4diAh608x9Bnk6HaIwCTXAgkiggSpPB6wmh3zwAZY4a2jlF8JAx3HJ7aXDTcTduz+HUJhpn7VRrNdk8iQjuQABxGokk4HT7QNMEfN4g7Il5ZCIFcdBwJuaSxedDV6iXRWOcqiljKpOgiEGsngwE9o+PjQVYzBTwU/mIx2LgsTkI+QOIkSRUCgXkSgUIggCLzYZALBricLjv7j3U9RzuRBIk8l4MSwo+2tpv6lPfMBo3Xv2z/bDL7b7imHB0RcmILXGJzel0XYlEImdlGbLPvB7Pyj1H38tjKas/rKmpoe54+BcAAP//s2wM4QAAAAZJREFUAwBgNRrhyMSTIwAAAABJRU5ErkJggg==';

const FooterBar = () => {
  const { t } = useTranslation();
  const [footer, setFooter] = useState(getFooterHTML());
  const systemName = getSystemName();
  const logo = getLogo();
  const [statusState] = useContext(StatusContext);
  const isDemoSiteMode = statusState?.status?.demo_site_enabled || false;
  const recordInfo = statusState?.status || {};

  const renderRecordLinkOrText = (text, link) => {
    if (!text) return null;
    if (link) {
      return (
        <a
          href={link}
          target='_blank'
          rel='noopener noreferrer'
          className='hover:underline'
        >
          {text}
        </a>
      );
    }
    return <span>{text}</span>;
  };

  const renderRecordItem = (icon, text, link, iconBgColor) => {
    if (!text) return null;
    return (
      <span className='inline-flex items-center gap-1.5'>
        <span
          className='inline-flex h-5 w-5 items-center justify-center rounded-full text-white'
          style={{ backgroundColor: iconBgColor }}
        >
          {typeof icon === 'function' ? (
            React.createElement(icon, { size: 12 })
          ) : (
            <img src={icon} alt='' className='h-3 w-3 object-contain' />
          )}
        </span>
        {renderRecordLinkOrText(text, link)}
      </span>
    );
  };

  const hasRecordInfo =
    recordInfo.company_name ||
    recordInfo.icp_record_number ||
    recordInfo.public_security_record_number ||
    recordInfo.telecom_value_added_license;
  const isSingleLineRecordBar = recordInfo.record_bar_layout === 'single';

  const recordBar = hasRecordInfo ? (
    <div
      className={`w-full max-w-[1110px] mt-4 pt-3 border-t border-semi-color-border text-xs text-semi-color-text-2 flex items-center gap-3 ${
        isSingleLineRecordBar
          ? 'justify-center whitespace-nowrap overflow-x-auto'
          : 'flex-wrap'
      }`}
    >
      {renderRecordItem(Building2, recordInfo.company_name, '', '#64748b')}
      {renderRecordItem(
        RECORD_ICON_ICP,
        recordInfo.icp_record_number,
        recordInfo.icp_record_link,
        '#f97316',
      )}
      {renderRecordItem(
        RECORD_ICON_PUBLIC_SECURITY,
        recordInfo.public_security_record_number,
        recordInfo.public_security_record_link,
        '#ef4444',
      )}
      {renderRecordItem(
        RECORD_ICON_TELECOM,
        recordInfo.telecom_value_added_license,
        recordInfo.telecom_value_added_license_link,
        '#10b981',
      )}
    </div>
  ) : null;

  const loadFooter = () => {
    let footer_html = localStorage.getItem('footer_html');
    if (footer_html) {
      setFooter(footer_html);
    }
  };

  const currentYear = new Date().getFullYear();

  const customFooter = useMemo(
    () => (
      <footer className='relative h-auto py-16 px-6 md:px-24 w-full flex flex-col items-center justify-between overflow-hidden'>
        <div className='absolute hidden md:block top-[204px] left-[-100px] w-[151px] h-[151px] rounded-full bg-[#FFD166]'></div>
        <div className='absolute md:hidden bottom-[20px] left-[-50px] w-[80px] h-[80px] rounded-full bg-[#FFD166] opacity-60'></div>

        {isDemoSiteMode && (
          <div className='flex flex-col md:flex-row justify-between w-full max-w-[1110px] mb-10 gap-8'>
            <div className='flex-shrink-0'>
              <img
                src={logo}
                alt={systemName}
                className='w-16 h-16 rounded-full bg-gray-800 p-1.5 object-contain'
              />
            </div>

            <div className='grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-8 w-full'>
              <div className='text-left'>
                <p className='!text-semi-color-text-0 font-semibold mb-5'>
                  {t('关于我们')}
                </p>
                <div className='flex flex-col gap-4'>
                  <a
                    href='https://docs.newapi.pro/wiki/project-introduction/'
                    target='_blank'
                    rel='noopener noreferrer'
                    className='!text-semi-color-text-1'
                  >
                    {t('关于项目')}
                  </a>
                  <a
                    href='https://docs.newapi.pro/support/community-interaction/'
                    target='_blank'
                    rel='noopener noreferrer'
                    className='!text-semi-color-text-1'
                  >
                    {t('联系我们')}
                  </a>
                  <a
                    href='https://docs.newapi.pro/wiki/features-introduction/'
                    target='_blank'
                    rel='noopener noreferrer'
                    className='!text-semi-color-text-1'
                  >
                    {t('功能特性')}
                  </a>
                </div>
              </div>

              <div className='text-left'>
                <p className='!text-semi-color-text-0 font-semibold mb-5'>
                  {t('文档')}
                </p>
                <div className='flex flex-col gap-4'>
                  <a
                    href='https://docs.newapi.pro/getting-started/'
                    target='_blank'
                    rel='noopener noreferrer'
                    className='!text-semi-color-text-1'
                  >
                    {t('快速开始')}
                  </a>
                  <a
                    href='https://docs.newapi.pro/installation/'
                    target='_blank'
                    rel='noopener noreferrer'
                    className='!text-semi-color-text-1'
                  >
                    {t('安装指南')}
                  </a>
                  <a
                    href='https://docs.newapi.pro/api/'
                    target='_blank'
                    rel='noopener noreferrer'
                    className='!text-semi-color-text-1'
                  >
                    {t('API 文档')}
                  </a>
                </div>
              </div>

              <div className='text-left'>
                <p className='!text-semi-color-text-0 font-semibold mb-5'>
                  {t('相关项目')}
                </p>
                <div className='flex flex-col gap-4'>
                  <a
                    href='https://github.com/songquanpeng/one-api'
                    target='_blank'
                    rel='noopener noreferrer'
                    className='!text-semi-color-text-1'
                  >
                    One API
                  </a>
                  <a
                    href='https://github.com/novicezk/midjourney-proxy'
                    target='_blank'
                    rel='noopener noreferrer'
                    className='!text-semi-color-text-1'
                  >
                    Midjourney-Proxy
                  </a>
                  <a
                    href='https://github.com/Calcium-Ion/neko-api-key-tool'
                    target='_blank'
                    rel='noopener noreferrer'
                    className='!text-semi-color-text-1'
                  >
                    neko-api-key-tool
                  </a>
                </div>
              </div>

              <div className='text-left'>
                <p className='!text-semi-color-text-0 font-semibold mb-5'>
                  {t('友情链接')}
                </p>
                <div className='flex flex-col gap-4'>
                  <a
                    href='https://github.com/Calcium-Ion/new-api-horizon'
                    target='_blank'
                    rel='noopener noreferrer'
                    className='!text-semi-color-text-1'
                  >
                    new-api-horizon
                  </a>
                  <a
                    href='https://github.com/coaidev/coai'
                    target='_blank'
                    rel='noopener noreferrer'
                    className='!text-semi-color-text-1'
                  >
                    CoAI
                  </a>
                  <a
                    href='https://www.gpt-load.com/'
                    target='_blank'
                    rel='noopener noreferrer'
                    className='!text-semi-color-text-1'
                  >
                    GPT-Load
                  </a>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className='flex flex-col md:flex-row items-center justify-between w-full max-w-[1110px] gap-6'>
          <div className='flex flex-wrap items-center gap-2'>
            <Typography.Text className='text-sm !text-semi-color-text-1'>
              © {currentYear} {systemName}. {t('版权所有')}
            </Typography.Text>
          </div>
        </div>
        {recordBar}
      </footer>
    ),
    [logo, systemName, t, currentYear, isDemoSiteMode, recordBar],
  );

  useEffect(() => {
    loadFooter();
  }, []);

  return (
    <div className='w-full'>
      {footer ? (
        <footer className='relative h-auto py-4 px-6 md:px-24 w-full flex items-center justify-center overflow-hidden'>
          <div className='flex flex-col md:flex-row items-center justify-between w-full max-w-[1110px] gap-4'>
            <div
              className='custom-footer na-cb6feafeb3990c78 text-sm !text-semi-color-text-1'
              dangerouslySetInnerHTML={{ __html: footer }}
            ></div>
          </div>
          {recordBar}
        </footer>
      ) : (
        customFooter
      )}
    </div>
  );
};

export default FooterBar;
