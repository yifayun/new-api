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

import React, { useContext, useEffect, useState } from 'react';
import {
  Button,
  Typography,
  Input,
  ScrollList,
  ScrollItem,
} from '@douyinfe/semi-ui';
import { API, showError, copy, showSuccess } from '../../helpers';
import { useIsMobile } from '../../hooks/common/useIsMobile';
import { API_ENDPOINTS } from '../../constants/common.constant';
import { StatusContext } from '../../context/Status';
import { useActualTheme } from '../../context/Theme';
import { marked } from 'marked';
import { useTranslation } from 'react-i18next';
import {
  IconGithubLogo,
  IconPlay,
  IconFile,
  IconCopy,
} from '@douyinfe/semi-icons';
import { Link } from 'react-router-dom';
import NoticeModal from '../../components/layout/NoticeModal';
import {
  Moonshot,
  OpenAI,
  XAI,
  Zhipu,
  Volcengine,
  Cohere,
  Claude,
  Gemini,
  Suno,
  Minimax,
  Wenxin,
  Spark,
  Qingyan,
  DeepSeek,
  Qwen,
  Midjourney,
  Grok,
  AzureAI,
  Hunyuan,
  Xinference,
} from '@lobehub/icons';

const { Text } = Typography;

const Home = () => {
  const { t, i18n } = useTranslation();
  const [statusState] = useContext(StatusContext);
  const actualTheme = useActualTheme();
  const [homePageContentLoaded, setHomePageContentLoaded] = useState(false);
  const [homePageContent, setHomePageContent] = useState('');
  const [noticeVisible, setNoticeVisible] = useState(false);
  const isMobile = useIsMobile();
  const isDemoSiteMode = statusState?.status?.demo_site_enabled || false;
  const docsLink = statusState?.status?.docs_link || '';
  const serverAddress =
    statusState?.status?.server_address || `${window.location.origin}`;
  const endpointItems = API_ENDPOINTS.map((e) => ({ value: e }));
  const [endpointIndex, setEndpointIndex] = useState(0);
  const isChinese = i18n.language.startsWith('zh');

  const displayHomePageContent = async () => {
    setHomePageContent(localStorage.getItem('home_page_content') || '');
    const res = await API.get('/api/home_page_content');
    const { success, message, data } = res.data;
    if (success) {
      let content = data;
      if (!data.startsWith('https://')) {
        content = marked.parse(data);
      }
      setHomePageContent(content);
      localStorage.setItem('home_page_content', content);

      // 如果内容是 URL，则发送主题模式
      if (data.startsWith('https://')) {
        const iframe = document.querySelector('iframe');
        if (iframe) {
          iframe.onload = () => {
            iframe.contentWindow.postMessage({ themeMode: actualTheme }, '*');
            iframe.contentWindow.postMessage({ lang: i18n.language }, '*');
          };
        }
      }
    } else {
      showError(message);
      setHomePageContent('加载首页内容失败...');
    }
    setHomePageContentLoaded(true);
  };

  const handleCopyBaseURL = async () => {
    const ok = await copy(serverAddress);
    if (ok) {
      showSuccess(t('已复制到剪切板'));
    }
  };

  useEffect(() => {
    const checkNoticeAndShow = async () => {
      const lastCloseDate = localStorage.getItem('notice_close_date');
      const today = new Date().toDateString();
      if (lastCloseDate !== today) {
        try {
          const res = await API.get('/api/notice');
          const { success, data } = res.data;
          if (success && data && data.trim() !== '') {
            setNoticeVisible(true);
          }
        } catch (error) {
          console.error('获取公告失败:', error);
        }
      }
    };

    checkNoticeAndShow();
  }, []);

  useEffect(() => {
    displayHomePageContent().then();
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      setEndpointIndex((prev) => (prev + 1) % endpointItems.length);
    }, 3000);
    return () => clearInterval(timer);
  }, [endpointItems.length]);

  return (
    <div className='w-full overflow-x-hidden'>
      <NoticeModal
        visible={noticeVisible}
        onClose={() => setNoticeVisible(false)}
        isMobile={isMobile}
      />
      {homePageContentLoaded && homePageContent === '' ? (
        <div className='w-full overflow-x-hidden'>
          <div className='cloud-home-wrapper'>
            <div className='cloud-home-gradient' />
            <div className='cloud-home-container'>
              <div className='cloud-home-hero'>
                <div className='cloud-home-left'>
                  <div className='cloud-home-badge'>AI Gateway Platform</div>
                  <h1
                    className={`cloud-home-title ${isChinese ? 'tracking-wide md:tracking-wider' : ''}`}
                  >
                    {t('统一的')}
                    <br />
                    <span className='cloud-home-title-accent'>
                      {t('大模型接口网关')}
                    </span>
                  </h1>
                  <p className='cloud-home-subtitle'>
                    {t('更好的价格，更好的稳定性，只需要将模型基址替换为：')}
                  </p>
                  <div className='cloud-hero-tags'>
                    <span className='cloud-hero-tag'>Enterprise Ready</span>
                    <span className='cloud-hero-tag'>OpenAI Compatible</span>
                    <span className='cloud-hero-tag'>Multi-Model Routing</span>
                  </div>

                  <div className='cloud-home-input-wrap'>
                    <Input
                      readonly
                      value={serverAddress}
                      size={isMobile ? 'default' : 'large'}
                      className='cloud-home-input'
                      suffix={
                        <div className='flex items-center gap-2'>
                          <ScrollList
                            bodyHeight={32}
                            style={{ border: 'unset', boxShadow: 'unset' }}
                          >
                            <ScrollItem
                              mode='wheel'
                              cycled={true}
                              list={endpointItems}
                              selectedIndex={endpointIndex}
                              onSelect={({ index }) => setEndpointIndex(index)}
                            />
                          </ScrollList>
                          <Button
                            type='primary'
                            onClick={handleCopyBaseURL}
                            icon={<IconCopy />}
                            className='!rounded-lg'
                          />
                        </div>
                      }
                    />
                  </div>

                  <div className='cloud-home-actions'>
                    <Link to='/console'>
                      <Button
                        theme='solid'
                        type='primary'
                        size={isMobile ? 'default' : 'large'}
                        className='cloud-home-btn-primary'
                        icon={<IconPlay />}
                      >
                        {t('获取密钥')}
                      </Button>
                    </Link>
                    {isDemoSiteMode && statusState?.status?.version ? (
                      <Button
                        size={isMobile ? 'default' : 'large'}
                        className='cloud-home-btn-secondary'
                        icon={<IconGithubLogo />}
                        onClick={() =>
                          window.open(
                            'https://github.com/QuantumNous/new-api',
                            '_blank',
                          )
                        }
                      >
                        {statusState.status.version}
                      </Button>
                    ) : (
                      docsLink && (
                        <Button
                          size={isMobile ? 'default' : 'large'}
                          className='cloud-home-btn-secondary'
                          icon={<IconFile />}
                          onClick={() => window.open(docsLink, '_blank')}
                        >
                          {t('文档')}
                        </Button>
                      )
                    )}
                  </div>
                </div>

                <div className='cloud-home-right'>
                  <div className='cloud-stat-card'>
                    <div className='cloud-stat-title'>{t('统一接入')}</div>
                    <div className='cloud-stat-value'>30+</div>
                    <div className='cloud-stat-desc'>
                      {t('支持众多的大模型供应商')}
                    </div>
                  </div>
                  <div className='cloud-stat-card'>
                    <div className='cloud-stat-title'>{t('高可用')}</div>
                    <div className='cloud-stat-value'>99.9%</div>
                    <div className='cloud-stat-desc'>
                      {t('更好的价格，更好的稳定性，只需要将模型基址替换为：')}
                    </div>
                  </div>
                  <div className='cloud-stat-card'>
                    <div className='cloud-stat-title'>API Base URL</div>
                    <div className='cloud-stat-desc break-all'>
                      {serverAddress}
                    </div>
                  </div>
                </div>
              </div>

              <div className='cloud-logo-panel'>
                <div className='cloud-logo-panel-title'>
                  <Text type='tertiary' className='text-base md:text-lg'>
                    {t('支持众多的大模型供应商')}
                  </Text>
                </div>
                <div className='cloud-logo-grid'>
                  <div className='cloud-logo-item'>
                    <Moonshot size={36} />
                  </div>
                  <div className='cloud-logo-item'>
                    <OpenAI size={36} />
                  </div>
                  <div className='cloud-logo-item'>
                    <XAI size={36} />
                  </div>
                  <div className='cloud-logo-item'>
                    <Zhipu.Color size={36} />
                  </div>
                  <div className='cloud-logo-item'>
                    <Volcengine.Color size={36} />
                  </div>
                  <div className='cloud-logo-item'>
                    <Cohere.Color size={36} />
                  </div>
                  <div className='cloud-logo-item'>
                    <Claude.Color size={36} />
                  </div>
                  <div className='cloud-logo-item'>
                    <Gemini.Color size={36} />
                  </div>
                  <div className='cloud-logo-item'>
                    <Suno size={36} />
                  </div>
                  <div className='cloud-logo-item'>
                    <Minimax.Color size={36} />
                  </div>
                  <div className='cloud-logo-item'>
                    <Wenxin.Color size={36} />
                  </div>
                  <div className='cloud-logo-item'>
                    <Spark.Color size={36} />
                  </div>
                  <div className='cloud-logo-item'>
                    <Qingyan.Color size={36} />
                  </div>
                  <div className='cloud-logo-item'>
                    <DeepSeek.Color size={36} />
                  </div>
                  <div className='cloud-logo-item'>
                    <Qwen.Color size={36} />
                  </div>
                  <div className='cloud-logo-item'>
                    <Midjourney size={36} />
                  </div>
                  <div className='cloud-logo-item'>
                    <Grok size={36} />
                  </div>
                  <div className='cloud-logo-item'>
                    <AzureAI.Color size={36} />
                  </div>
                  <div className='cloud-logo-item'>
                    <Hunyuan.Color size={36} />
                  </div>
                  <div className='cloud-logo-item'>
                    <Xinference.Color size={36} />
                  </div>
                  <div className='cloud-logo-item cloud-logo-count'>
                    <Typography.Text className='!text-xl font-bold'>
                      30+
                    </Typography.Text>
                  </div>
                </div>
              </div>

              <div className='cloud-capability-grid'>
                <div className='cloud-capability-card'>
                  <h3>统一网关接入</h3>
                  <p>
                    通过单一网关统一管理供应商渠道、鉴权策略与模型路由，减少多平台接入成本。
                  </p>
                </div>
                <div className='cloud-capability-card'>
                  <h3>企业级稳定性</h3>
                  <p>
                    结合缓存、限流与渠道容灾能力，保障核心业务在高并发场景下持续可用。
                  </p>
                </div>
                <div className='cloud-capability-card'>
                  <h3>精细化成本控制</h3>
                  <p>
                    支持分组倍率、模型倍率与多维度计费展示，帮助团队实现可追踪、可优化的成本治理。
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className='overflow-x-hidden w-full'>
          {homePageContent.startsWith('https://') ? (
            <iframe
              src={homePageContent}
              className='w-full h-screen border-none'
            />
          ) : (
            <div
              className='mt-[60px]'
              dangerouslySetInnerHTML={{ __html: homePageContent }}
            />
          )}
        </div>
      )}
    </div>
  );
};

export default Home;
