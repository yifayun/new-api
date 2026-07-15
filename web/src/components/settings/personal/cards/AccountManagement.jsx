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

import React from 'react';
import {
  Button,
  Card,
  Input,
  Space,
  Typography,
  Avatar,
  Tabs,
  TabPane,
  Popover,
  Modal,
  RadioGroup,
  Radio,
} from '@douyinfe/semi-ui';
import {
  IconMail,
  IconShield,
  IconGithubLogo,
  IconKey,
  IconLock,
  IconDelete,
} from '@douyinfe/semi-icons';
import { SiTelegram, SiWechat, SiLinux, SiDiscord } from 'react-icons/si';
import { UserPlus, ShieldCheck } from 'lucide-react';
import TelegramLoginButton from 'react-telegram-login';
import {
  API,
  showError,
  showSuccess,
  onGitHubOAuthClicked,
  onOIDCClicked,
  onLinuxDOOAuthClicked,
  onDiscordOAuthClicked,
  onCustomOAuthClicked,
  getOAuthProviderIcon,
} from '../../../../helpers';
import TwoFASetting from '../components/TwoFASetting';
import { QRCodeSVG } from 'qrcode.react';

const AccountManagement = ({
  t,
  userState,
  status,
  systemToken,
  setShowEmailBindModal,
  setShowWeChatBindModal,
  generateAccessToken,
  handleSystemTokenClick,
  setShowChangePasswordModal,
  setShowAccountDeleteModal,
  passkeyStatus,
  passkeySupported,
  passkeyRegisterLoading,
  passkeyDeleteLoading,
  onPasskeyRegister,
  onPasskeyDelete,
  deleteRequestStatus,
  onCancelDeleteRequest,
  refreshUserData,
}) => {
  const renderAccountInfo = (accountId, label) => {
    if (!accountId || accountId === '') {
      return <span className='text-gray-500'>{t('未绑定')}</span>;
    }

    const popContent = (
      <div className='text-xs p-2'>
        <Typography.Paragraph copyable={{ content: accountId }}>
          {accountId}
        </Typography.Paragraph>
        {label ? (
          <div className='mt-1 text-[11px] text-gray-500'>{label}</div>
        ) : null}
      </div>
    );

    return (
      <Popover content={popContent} position='top' trigger='hover'>
        <span className='block max-w-full truncate text-gray-600 hover:text-blue-600 cursor-pointer'>
          {accountId}
        </span>
      </Popover>
    );
  };
  const isBound = (accountId) => Boolean(accountId);
  const [showTelegramBindModal, setShowTelegramBindModal] =
    React.useState(false);
  const [showRealNameModal, setShowRealNameModal] = React.useState(false);
  const businessLicenseFileInputRef = React.useRef(null);
  const [realNameInput, setRealNameInput] = React.useState({
    real_name: '',
    id_card: '',
    real_name_type: 'personal',
    company_name: '',
    company_tax_no: '',
    business_license_image: '',
  });
  const [realNameLoading, setRealNameLoading] = React.useState(false);
  const [showRealNameQrModal, setShowRealNameQrModal] = React.useState(false);
  const [realNameAppUrl, setRealNameAppUrl] = React.useState('');
  const [customOAuthBindings, setCustomOAuthBindings] = React.useState([]);
  const [customOAuthLoading, setCustomOAuthLoading] = React.useState({});

  // Fetch custom OAuth bindings
  const loadCustomOAuthBindings = async () => {
    try {
      const res = await API.get('/api/user/oauth/bindings');
      if (res.data.success) {
        setCustomOAuthBindings(res.data.data || []);
      } else {
        showError(res.data.message || t('获取绑定信息失败'));
      }
    } catch (error) {
      showError(
        error.response?.data?.message || error.message || t('获取绑定信息失败'),
      );
    }
  };

  // Unbind custom OAuth provider
  const handleUnbindCustomOAuth = async (providerId, providerName) => {
    Modal.confirm({
      title: t('确认解绑'),
      content: t('确定要解绑 {{name}} 吗？', { name: providerName }),
      okText: t('确认'),
      cancelText: t('取消'),
      onOk: async () => {
        setCustomOAuthLoading((prev) => ({ ...prev, [providerId]: true }));
        try {
          const res = await API.delete(
            `/api/user/oauth/bindings/${providerId}`,
          );
          if (res.data.success) {
            showSuccess(t('解绑成功'));
            await loadCustomOAuthBindings();
          } else {
            showError(res.data.message);
          }
        } catch (error) {
          showError(
            error.response?.data?.message || error.message || t('操作失败'),
          );
        } finally {
          setCustomOAuthLoading((prev) => ({ ...prev, [providerId]: false }));
        }
      },
    });
  };

  // Handle bind custom OAuth
  const handleBindCustomOAuth = (provider) => {
    onCustomOAuthClicked(provider);
  };

  // Check if custom OAuth provider is bound
  const isCustomOAuthBound = (providerId) => {
    const normalizedId = Number(providerId);
    return customOAuthBindings.some(
      (b) => Number(b.provider_id) === normalizedId,
    );
  };

  // Get binding info for a provider
  const getCustomOAuthBinding = (providerId) => {
    const normalizedId = Number(providerId);
    return customOAuthBindings.find(
      (b) => Number(b.provider_id) === normalizedId,
    );
  };

  React.useEffect(() => {
    loadCustomOAuthBindings();
  }, []);

  const passkeyEnabled = passkeyStatus?.enabled;
  const realNameEnabled = status?.realname_verification;
  const realNamePassed = userState.user?.real_name_verified;
  const realNameStatus = userState.user?.real_name_status || 'none';
  const realNameType = userState.user?.real_name_type || 'personal';
  const isEnterpriseUpgradeFlow = realNamePassed && realNameType === 'personal';
  const realNameStatusLabelMap = {
    none: t('未认证'),
    pending: t('认证中'),
    passed: t('已通过'),
    rejected: t('未通过'),
    enterprise_pending: t('企业待审核'),
    enterprise_rejected: t('企业审核驳回'),
  };
  const realNameStatusLabel =
    realNameStatusLabelMap[realNameStatus] || realNameStatus;
  const lastUsedLabel = passkeyStatus?.last_used_at
    ? new Date(passkeyStatus.last_used_at).toLocaleString()
    : t('尚未使用');
  const handleStartRealName = async () => {
    if (!realNameInput.real_name || !realNameInput.id_card) {
      showError(t('请填写姓名和身份证号'));
      return;
    }
    if (realNameInput.real_name_type === 'enterprise') {
      if (
        !realNameInput.company_name ||
        !realNameInput.company_tax_no ||
        !realNameInput.business_license_image
      ) {
        showError(t('企业认证需填写企业名称、企业税号并上传营业执照'));
        return;
      }
    }
    setRealNameLoading(true);
    try {
      const res = await API.post('/api/user/realname/initiate', realNameInput);
      if (res.data.success) {
        const certifyUrl = res.data?.data?.certify_url;
        const certifyAlipaysUrl = res.data?.data?.certify_alipays_url;
        const certifyForm = res.data?.data?.certify_form;
        showSuccess(
          realNameInput.real_name_type === 'enterprise'
            ? t('企业实名已发起，请先完成支付宝扫脸，完成后将进入管理员审核')
            : t('实名认证发起成功，请完成支付宝认证'),
        );
        setShowRealNameModal(false);
        const isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(
          navigator.userAgent,
        );
        if (isMobile && certifyAlipaysUrl) {
          window.location.href = certifyAlipaysUrl;
        } else if (isMobile && certifyForm) {
          const popup = window.open('', '_blank');
          if (popup) {
            popup.document.open();
            popup.document.write(certifyForm);
            popup.document.close();
          } else if (certifyUrl) {
            window.open(certifyUrl, '_blank');
          }
        } else if (isMobile && certifyUrl) {
          window.open(certifyUrl, '_blank');
        }
        if (!isMobile && certifyAlipaysUrl) {
          setRealNameAppUrl(certifyAlipaysUrl);
          setShowRealNameQrModal(true);
        } else if (!isMobile && certifyForm) {
          const popup = window.open('', '_blank');
          if (popup) {
            popup.document.open();
            popup.document.write(certifyForm);
            popup.document.close();
          } else if (certifyUrl) {
            window.open(certifyUrl, '_blank');
          }
        } else if (!isMobile && certifyUrl) {
          window.open(certifyUrl, '_blank');
        }
      } else {
        showError(res.data.message);
      }
    } catch (error) {
      showError(
        error.response?.data?.message || error.message || t('实名认证发起失败'),
      );
    } finally {
      setRealNameLoading(false);
    }
  };

  const handleRefreshRealName = async () => {
    setRealNameLoading(true);
    try {
      const res = await API.post('/api/user/realname/refresh');
      if (res.data.success) {
        if (refreshUserData) {
          await refreshUserData();
        }
        showSuccess(t('实名认证状态已更新，请刷新页面查看结果'));
      } else {
        showError(res.data.message);
      }
    } catch (error) {
      showError(
        error.response?.data?.message ||
          error.message ||
          t('刷新实名认证状态失败'),
      );
    } finally {
      setRealNameLoading(false);
    }
  };

  return (
    <Card className='personal-account-card !rounded-2xl'>
      {/* 卡片头部 */}
      <div className='personal-panel-header flex items-center mb-4'>
        <Avatar size='small' color='teal' className='mr-3 shadow-md'>
          <UserPlus size={16} />
        </Avatar>
        <div>
          <Typography.Text className='personal-panel-title text-lg font-medium'>
            {t('账户管理')}
          </Typography.Text>
          <div className='text-xs text-gray-600'>
            {t('账户绑定、安全设置和身份验证')}
          </div>
        </div>
      </div>

      <Tabs type='card' defaultActiveKey='binding'>
        {/* 账户绑定 Tab */}
        <TabPane
          tab={
            <div className='flex items-center'>
              <UserPlus size={16} className='mr-2' />
              {t('账户绑定')}
            </div>
          }
          itemKey='binding'
        >
          <div className='py-4'>
            <div className='grid grid-cols-1 lg:grid-cols-2 gap-4'>
              {/* 邮箱绑定 */}
              <Card className='personal-subcard !rounded-xl'>
                <div className='flex items-center justify-between gap-3'>
                  <div className='flex items-center flex-1 min-w-0'>
                    <div className='w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center mr-3 flex-shrink-0'>
                      <IconMail
                        size='default'
                        className='text-slate-600 dark:text-slate-300'
                      />
                    </div>
                    <div className='flex-1 min-w-0'>
                      <div className='font-medium text-gray-900'>
                        {t('邮箱')}
                      </div>
                      <div className='text-sm text-gray-500 truncate'>
                        {renderAccountInfo(
                          userState.user?.email,
                          t('邮箱地址'),
                        )}
                      </div>
                    </div>
                  </div>
                  <div className='flex-shrink-0'>
                    <Button
                      type='primary'
                      theme='outline'
                      size='small'
                      onClick={() => setShowEmailBindModal(true)}
                    >
                      {isBound(userState.user?.email)
                        ? t('修改绑定')
                        : t('绑定')}
                    </Button>
                  </div>
                </div>
              </Card>

              {/* 微信绑定 */}
              <Card className='personal-subcard !rounded-xl'>
                <div className='flex items-center justify-between gap-3'>
                  <div className='flex items-center flex-1 min-w-0'>
                    <div className='w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center mr-3 flex-shrink-0'>
                      <SiWechat
                        size={20}
                        className='text-slate-600 dark:text-slate-300'
                      />
                    </div>
                    <div className='flex-1 min-w-0'>
                      <div className='font-medium text-gray-900'>
                        {t('微信')}
                      </div>
                      <div className='text-sm text-gray-500 truncate'>
                        {!status.wechat_login
                          ? t('未启用')
                          : isBound(userState.user?.wechat_id)
                            ? t('已绑定')
                            : t('未绑定')}
                      </div>
                    </div>
                  </div>
                  <div className='flex-shrink-0'>
                    <Button
                      type='primary'
                      theme='outline'
                      size='small'
                      disabled={!status.wechat_login}
                      onClick={() => setShowWeChatBindModal(true)}
                    >
                      {isBound(userState.user?.wechat_id)
                        ? t('修改绑定')
                        : status.wechat_login
                          ? t('绑定')
                          : t('未启用')}
                    </Button>
                  </div>
                </div>
              </Card>

              {/* GitHub绑定 */}
              <Card className='personal-subcard !rounded-xl'>
                <div className='flex items-center justify-between gap-3'>
                  <div className='flex items-center flex-1 min-w-0'>
                    <div className='w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center mr-3 flex-shrink-0'>
                      <IconGithubLogo
                        size='default'
                        className='text-slate-600 dark:text-slate-300'
                      />
                    </div>
                    <div className='flex-1 min-w-0'>
                      <div className='font-medium text-gray-900'>
                        {t('GitHub')}
                      </div>
                      <div className='text-sm text-gray-500 truncate'>
                        {renderAccountInfo(
                          userState.user?.github_id,
                          t('GitHub ID'),
                        )}
                      </div>
                    </div>
                  </div>
                  <div className='flex-shrink-0'>
                    <Button
                      type='primary'
                      theme='outline'
                      size='small'
                      onClick={() =>
                        onGitHubOAuthClicked(status.github_client_id)
                      }
                      disabled={
                        isBound(userState.user?.github_id) ||
                        !status.github_oauth
                      }
                    >
                      {status.github_oauth ? t('绑定') : t('未启用')}
                    </Button>
                  </div>
                </div>
              </Card>

              {/* Discord绑定 */}
              <Card className='personal-subcard !rounded-xl'>
                <div className='flex items-center justify-between gap-3'>
                  <div className='flex items-center flex-1 min-w-0'>
                    <div className='w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center mr-3 flex-shrink-0'>
                      <SiDiscord
                        size={20}
                        className='text-slate-600 dark:text-slate-300'
                      />
                    </div>
                    <div className='flex-1 min-w-0'>
                      <div className='font-medium text-gray-900'>
                        {t('Discord')}
                      </div>
                      <div className='text-sm text-gray-500 truncate'>
                        {renderAccountInfo(
                          userState.user?.discord_id,
                          t('Discord ID'),
                        )}
                      </div>
                    </div>
                  </div>
                  <div className='flex-shrink-0'>
                    <Button
                      type='primary'
                      theme='outline'
                      size='small'
                      onClick={() =>
                        onDiscordOAuthClicked(status.discord_client_id)
                      }
                      disabled={
                        isBound(userState.user?.discord_id) ||
                        !status.discord_oauth
                      }
                    >
                      {status.discord_oauth ? t('绑定') : t('未启用')}
                    </Button>
                  </div>
                </div>
              </Card>

              {/* OIDC绑定 */}
              <Card className='personal-subcard !rounded-xl'>
                <div className='flex items-center justify-between gap-3'>
                  <div className='flex items-center flex-1 min-w-0'>
                    <div className='w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center mr-3 flex-shrink-0'>
                      <IconShield
                        size='default'
                        className='text-slate-600 dark:text-slate-300'
                      />
                    </div>
                    <div className='flex-1 min-w-0'>
                      <div className='font-medium text-gray-900'>
                        {t('OIDC')}
                      </div>
                      <div className='text-sm text-gray-500 truncate'>
                        {renderAccountInfo(
                          userState.user?.oidc_id,
                          t('OIDC ID'),
                        )}
                      </div>
                    </div>
                  </div>
                  <div className='flex-shrink-0'>
                    <Button
                      type='primary'
                      theme='outline'
                      size='small'
                      onClick={() =>
                        onOIDCClicked(
                          status.oidc_authorization_endpoint,
                          status.oidc_client_id,
                        )
                      }
                      disabled={
                        isBound(userState.user?.oidc_id) || !status.oidc_enabled
                      }
                    >
                      {status.oidc_enabled ? t('绑定') : t('未启用')}
                    </Button>
                  </div>
                </div>
              </Card>

              {/* Telegram绑定 */}
              <Card className='personal-subcard !rounded-xl'>
                <div className='flex items-center justify-between gap-3'>
                  <div className='flex items-center flex-1 min-w-0'>
                    <div className='w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center mr-3 flex-shrink-0'>
                      <SiTelegram
                        size={20}
                        className='text-slate-600 dark:text-slate-300'
                      />
                    </div>
                    <div className='flex-1 min-w-0'>
                      <div className='font-medium text-gray-900'>
                        {t('Telegram')}
                      </div>
                      <div className='text-sm text-gray-500 truncate'>
                        {renderAccountInfo(
                          userState.user?.telegram_id,
                          t('Telegram ID'),
                        )}
                      </div>
                    </div>
                  </div>
                  <div className='flex-shrink-0'>
                    {status.telegram_oauth ? (
                      isBound(userState.user?.telegram_id) ? (
                        <Button
                          disabled
                          size='small'
                          type='primary'
                          theme='outline'
                        >
                          {t('已绑定')}
                        </Button>
                      ) : (
                        <Button
                          type='primary'
                          theme='outline'
                          size='small'
                          onClick={() => setShowTelegramBindModal(true)}
                        >
                          {t('绑定')}
                        </Button>
                      )
                    ) : (
                      <Button
                        disabled
                        size='small'
                        type='primary'
                        theme='outline'
                      >
                        {t('未启用')}
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
              <Modal
                title={t('绑定 Telegram')}
                visible={showTelegramBindModal}
                onCancel={() => setShowTelegramBindModal(false)}
                footer={null}
              >
                <div className='my-3 text-sm text-gray-600'>
                  {t('点击下方按钮通过 Telegram 完成绑定')}
                </div>
                <div className='flex justify-center'>
                  <div className='scale-90'>
                    <TelegramLoginButton
                      dataAuthUrl='/api/oauth/telegram/bind'
                      botName={status.telegram_bot_name}
                    />
                  </div>
                </div>
              </Modal>

              {/* LinuxDO绑定 */}
              <Card className='personal-subcard !rounded-xl'>
                <div className='flex items-center justify-between gap-3'>
                  <div className='flex items-center flex-1 min-w-0'>
                    <div className='w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center mr-3 flex-shrink-0'>
                      <SiLinux
                        size={20}
                        className='text-slate-600 dark:text-slate-300'
                      />
                    </div>
                    <div className='flex-1 min-w-0'>
                      <div className='font-medium text-gray-900'>
                        {t('LinuxDO')}
                      </div>
                      <div className='text-sm text-gray-500 truncate'>
                        {renderAccountInfo(
                          userState.user?.linux_do_id,
                          t('LinuxDO ID'),
                        )}
                      </div>
                    </div>
                  </div>
                  <div className='flex-shrink-0'>
                    <Button
                      type='primary'
                      theme='outline'
                      size='small'
                      onClick={() =>
                        onLinuxDOOAuthClicked(status.linuxdo_client_id)
                      }
                      disabled={
                        isBound(userState.user?.linux_do_id) ||
                        !status.linuxdo_oauth
                      }
                    >
                      {status.linuxdo_oauth ? t('绑定') : t('未启用')}
                    </Button>
                  </div>
                </div>
              </Card>

              {/* 自定义 OAuth 提供商绑定 */}
              {status.custom_oauth_providers &&
                status.custom_oauth_providers.map((provider) => {
                  const bound = isCustomOAuthBound(provider.id);
                  const binding = getCustomOAuthBinding(provider.id);
                  return (
                    <Card
                      key={provider.slug}
                      className='personal-subcard !rounded-xl'
                    >
                      <div className='flex items-center justify-between gap-3'>
                        <div className='flex items-center flex-1 min-w-0'>
                          <div className='w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center mr-3 flex-shrink-0'>
                            {getOAuthProviderIcon(
                              provider.icon || binding?.provider_icon || '',
                              20,
                            )}
                          </div>
                          <div className='flex-1 min-w-0'>
                            <div className='font-medium text-gray-900'>
                              {provider.name}
                            </div>
                            <div className='text-sm text-gray-500 truncate'>
                              {bound
                                ? renderAccountInfo(
                                    binding?.provider_user_id,
                                    t('{{name}} ID', { name: provider.name }),
                                  )
                                : t('未绑定')}
                            </div>
                          </div>
                        </div>
                        <div className='flex-shrink-0'>
                          {bound ? (
                            <Button
                              type='danger'
                              theme='outline'
                              size='small'
                              loading={customOAuthLoading[provider.id]}
                              onClick={() =>
                                handleUnbindCustomOAuth(
                                  provider.id,
                                  provider.name,
                                )
                              }
                            >
                              {t('解绑')}
                            </Button>
                          ) : (
                            <Button
                              type='primary'
                              theme='outline'
                              size='small'
                              onClick={() => handleBindCustomOAuth(provider)}
                            >
                              {t('绑定')}
                            </Button>
                          )}
                        </div>
                      </div>
                    </Card>
                  );
                })}
            </div>
          </div>
        </TabPane>

        {/* 安全设置 Tab */}
        <TabPane
          tab={
            <div className='flex items-center'>
              <ShieldCheck size={16} className='mr-2' />
              {t('安全设置')}
            </div>
          }
          itemKey='security'
        >
          <div className='py-4'>
            <div className='space-y-6'>
              <Space vertical className='w-full'>
                {/* 系统访问令牌 */}
                <Card className='personal-subcard !rounded-xl w-full'>
                  <div className='flex flex-col sm:flex-row items-start sm:justify-between gap-4'>
                    <div className='flex items-start w-full sm:w-auto'>
                      <div className='w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mr-4 flex-shrink-0'>
                        <IconKey size='large' className='text-slate-600' />
                      </div>
                      <div className='flex-1'>
                        <Typography.Title heading={6} className='mb-1'>
                          {t('系统访问令牌')}
                        </Typography.Title>
                        <Typography.Text type='tertiary' className='text-sm'>
                          {t('用于API调用的身份验证令牌，请妥善保管')}
                        </Typography.Text>
                        {systemToken && (
                          <div className='mt-3'>
                            <Input
                              readonly
                              value={systemToken}
                              onClick={handleSystemTokenClick}
                              size='large'
                              prefix={<IconKey />}
                            />
                          </div>
                        )}
                      </div>
                    </div>
                    <Button
                      type='primary'
                      theme='solid'
                      onClick={generateAccessToken}
                      className='!bg-slate-600 hover:!bg-slate-700 w-full sm:w-auto'
                      icon={<IconKey />}
                    >
                      {systemToken ? t('重新生成') : t('生成令牌')}
                    </Button>
                  </div>
                </Card>

                {/* 密码管理 */}
                <Card className='personal-subcard !rounded-xl w-full'>
                  <div className='flex flex-col sm:flex-row items-start sm:justify-between gap-4'>
                    <div className='flex items-start w-full sm:w-auto'>
                      <div className='w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mr-4 flex-shrink-0'>
                        <IconLock size='large' className='text-slate-600' />
                      </div>
                      <div>
                        <Typography.Title heading={6} className='mb-1'>
                          {t('密码管理')}
                        </Typography.Title>
                        <Typography.Text type='tertiary' className='text-sm'>
                          {t('定期更改密码可以提高账户安全性')}
                        </Typography.Text>
                      </div>
                    </div>
                    <Button
                      type='primary'
                      theme='solid'
                      onClick={() => setShowChangePasswordModal(true)}
                      className='!bg-slate-600 hover:!bg-slate-700 w-full sm:w-auto'
                      icon={<IconLock />}
                    >
                      {t('修改密码')}
                    </Button>
                  </div>
                </Card>

                {/* Passkey 设置 */}
                <Card className='personal-subcard !rounded-xl w-full'>
                  <div className='flex flex-col sm:flex-row items-start sm:justify-between gap-4'>
                    <div className='flex items-start w-full sm:w-auto'>
                      <div className='w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mr-4 flex-shrink-0'>
                        <IconKey size='large' className='text-slate-600' />
                      </div>
                      <div>
                        <Typography.Title heading={6} className='mb-1'>
                          {t('Passkey 登录')}
                        </Typography.Title>
                        <Typography.Text type='tertiary' className='text-sm'>
                          {passkeyEnabled
                            ? t('已启用 Passkey，无需密码即可登录')
                            : t('使用 Passkey 实现免密且更安全的登录体验')}
                        </Typography.Text>
                        <div className='mt-2 text-xs text-gray-500 space-y-1'>
                          <div>
                            {t('最后使用时间')}：{lastUsedLabel}
                          </div>
                          {/*{passkeyEnabled && (*/}
                          {/*  <div>*/}
                          {/*    {t('备份支持')}：*/}
                          {/*    {passkeyStatus?.backup_eligible*/}
                          {/*      ? t('支持备份')*/}
                          {/*      : t('不支持')}*/}
                          {/*    ，{t('备份状态')}：*/}
                          {/*    {passkeyStatus?.backup_state ? t('已备份') : t('未备份')}*/}
                          {/*  </div>*/}
                          {/*)}*/}
                          {!passkeySupported && (
                            <div className='text-amber-600'>
                              {t('当前设备不支持 Passkey')}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    <Button
                      type={passkeyEnabled ? 'danger' : 'primary'}
                      theme={passkeyEnabled ? 'solid' : 'solid'}
                      onClick={
                        passkeyEnabled
                          ? () => {
                              Modal.confirm({
                                title: t('确认解绑 Passkey'),
                                content: t(
                                  '解绑后将无法使用 Passkey 登录，确定要继续吗？',
                                ),
                                okText: t('确认解绑'),
                                cancelText: t('取消'),
                                okType: 'danger',
                                onOk: onPasskeyDelete,
                              });
                            }
                          : onPasskeyRegister
                      }
                      className={`w-full sm:w-auto ${passkeyEnabled ? '!bg-slate-500 hover:!bg-slate-600' : ''}`}
                      icon={<IconKey />}
                      disabled={!passkeySupported && !passkeyEnabled}
                      loading={
                        passkeyEnabled
                          ? passkeyDeleteLoading
                          : passkeyRegisterLoading
                      }
                    >
                      {passkeyEnabled ? t('解绑 Passkey') : t('注册 Passkey')}
                    </Button>
                  </div>
                </Card>

                {/* 两步验证设置 */}
                <TwoFASetting t={t} />

                <Card className='personal-subcard !rounded-xl w-full'>
                  <div className='flex flex-col sm:flex-row items-start sm:justify-between gap-4'>
                    <div className='flex items-start w-full sm:w-auto'>
                      <div className='w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mr-4 flex-shrink-0'>
                        <IconShield size='large' className='text-slate-600' />
                      </div>
                      <div>
                        <Typography.Title heading={6} className='mb-1'>
                          {t('芝麻信用实名认证')}
                        </Typography.Title>
                        <Typography.Text type='tertiary' className='text-sm'>
                          {!realNameEnabled
                            ? t('后台暂未开启实名认证')
                            : realNamePassed
                              ? t('实名认证已通过')
                              : t('实名认证是系统必需项，请先完成认证')}
                        </Typography.Text>
                        <div className='mt-2 text-xs text-gray-500'>
                          {t('当前状态')}:{' '}
                          {realNameEnabled ? realNameStatusLabel : t('未启用')}
                        </div>
                        <div className='mt-1 text-xs text-gray-500'>
                          {t('支持个人认证升级为企业认证，不支持企业认证降级为个人认证')}
                        </div>
                      </div>
                    </div>
                    <div className='flex gap-2 w-full sm:w-auto'>
                      {realNameEnabled ? (
                        <>
                          {(!realNamePassed || realNameType === 'personal') && (
                            <Button
                              type='primary'
                              theme='solid'
                              loading={realNameLoading}
                              onClick={() => {
                                setRealNameInput((prev) => ({
                                  ...prev,
                                  real_name_type: realNamePassed
                                    ? 'enterprise'
                                    : prev.real_name_type || 'personal',
                                  real_name: userState.user?.real_name_name || '',
                                  id_card: userState.user?.real_name_id_card || '',
                                }));
                                setShowRealNameModal(true);
                              }}
                              className='w-full sm:w-auto'
                            >
                              {realNamePassed ? t('升级企业认证') : t('立即认证')}
                            </Button>
                          )}
                          <Button
                            type='primary'
                            theme='outline'
                            loading={realNameLoading}
                            onClick={handleRefreshRealName}
                            className='w-full sm:w-auto'
                          >
                            {t('刷新状态')}
                          </Button>
                        </>
                      ) : (
                        <Button
                          type='primary'
                          theme='outline'
                          disabled
                          className='w-full sm:w-auto'
                        >
                          {t('后台未开启')}
                        </Button>
                      )}
                    </div>
                  </div>
                </Card>

                {/* 危险区域 */}
                <Card className='personal-subcard !rounded-xl w-full'>
                  <div className='flex flex-col sm:flex-row items-start sm:justify-between gap-4'>
                    <div className='flex items-start w-full sm:w-auto'>
                      <div className='w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mr-4 flex-shrink-0'>
                        <IconDelete size='large' className='text-slate-600' />
                      </div>
                      <div>
                        <Typography.Title
                          heading={6}
                          className='mb-1 text-slate-700'
                        >
                          {t('删除账户')}
                        </Typography.Title>
                        <Typography.Text type='tertiary' className='text-sm'>
                          {deleteRequestStatus?.status === 'pending'
                            ? t('已提交删除申请，等待管理员审批')
                            : t('提交删除申请后，需管理员同意后才会生效')}
                        </Typography.Text>
                        {deleteRequestStatus?.status && (
                          <div className='mt-2 text-xs text-gray-500'>
                            {t('当前状态')}: {deleteRequestStatus.status}
                          </div>
                        )}
                      </div>
                    </div>
                    {deleteRequestStatus?.status === 'pending' ? (
                      <Button
                        type='primary'
                        theme='outline'
                        onClick={onCancelDeleteRequest}
                        className='w-full sm:w-auto'
                      >
                        {t('撤销申请')}
                      </Button>
                    ) : (
                      <Button
                        type='danger'
                        theme='solid'
                        onClick={() => setShowAccountDeleteModal(true)}
                        className='w-full sm:w-auto !bg-slate-500 hover:!bg-slate-600'
                        icon={<IconDelete />}
                      >
                        {t('申请删除账户')}
                      </Button>
                    )}
                  </div>
                </Card>
              </Space>
            </div>
          </div>
        </TabPane>
      </Tabs>
      <Modal
        title={t('发起实名认证')}
        visible={showRealNameModal}
        onCancel={() => setShowRealNameModal(false)}
        onOk={handleStartRealName}
        okText={t('确认并前往支付宝')}
        confirmLoading={realNameLoading}
      >
        <div className='mb-3'>
          <Typography.Text type='secondary'>
            {t('支持个人认证升级为企业认证，不支持企业认证降级为个人认证')}
          </Typography.Text>
        </div>
        <div className='mb-3'>
          <Typography.Text strong>{t('认证类型')}</Typography.Text>
          <div className='mt-2'>
            <RadioGroup
              type='button'
              value={realNameInput.real_name_type}
              onChange={(e) => {
                const nextType = e?.target?.value || 'personal';
                if (
                  (realNameType === 'enterprise' || isEnterpriseUpgradeFlow) &&
                  nextType === 'personal'
                ) {
                  showError(t('不支持企业认证降级为个人认证'));
                  return;
                }
                setRealNameInput((prev) => ({
                  ...prev,
                  real_name_type: nextType,
                }));
              }}
            >
              <Radio
                value='personal'
                disabled={realNameType === 'enterprise' || isEnterpriseUpgradeFlow}
              >
                {t('个人认证')}
              </Radio>
              <Radio value='enterprise'>{t('企业认证')}</Radio>
            </RadioGroup>
          </div>
        </div>
        <Input
          placeholder={t('请输入真实姓名')}
          value={realNameInput.real_name}
          onChange={(value) =>
            setRealNameInput((prev) => ({ ...prev, real_name: value }))
          }
          className='mb-3'
        />
        <Input
          placeholder={t('请输入身份证号')}
          value={realNameInput.id_card}
          onChange={(value) =>
            setRealNameInput((prev) => ({ ...prev, id_card: value }))
          }
        />
        {realNameInput.real_name_type === 'enterprise' ? (
          <>
            <Input
              className='mt-3'
              placeholder={t('请输入企业名称')}
              value={realNameInput.company_name}
              onChange={(value) =>
                setRealNameInput((prev) => ({ ...prev, company_name: value }))
              }
            />
            <Input
              className='mt-3'
              placeholder={t('请输入企业税号')}
              value={realNameInput.company_tax_no}
              onChange={(value) =>
                setRealNameInput((prev) => ({ ...prev, company_tax_no: value }))
              }
            />
            <div className='mt-3'>
              <Typography.Text>{t('营业执照（图片URL或Base64）')}</Typography.Text>
              <div className='mt-2 flex gap-2'>
                <Input
                  placeholder={t('请粘贴营业执照图片URL或Base64')}
                  value={realNameInput.business_license_image}
                  onChange={(value) =>
                    setRealNameInput((prev) => ({
                      ...prev,
                      business_license_image: value,
                    }))
                  }
                />
                <Button
                  theme='outline'
                  onClick={() => businessLicenseFileInputRef.current?.click()}
                >
                  {t('上传图片')}
                </Button>
              </div>
              <input
                ref={businessLicenseFileInputRef}
                type='file'
                accept='image/*'
                style={{ display: 'none' }}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const reader = new FileReader();
                  reader.onload = () => {
                    const base64 = reader.result;
                    if (typeof base64 === 'string') {
                      setRealNameInput((prev) => ({
                        ...prev,
                        business_license_image: base64,
                      }));
                    }
                  };
                  reader.readAsDataURL(file);
                  e.target.value = '';
                }}
              />
            </div>
          </>
        ) : null}
      </Modal>
      <Modal
        title={t('请使用支付宝扫码继续认证')}
        visible={showRealNameQrModal}
        footer={null}
        onCancel={() => setShowRealNameQrModal(false)}
      >
        <div className='flex flex-col items-center gap-3'>
          {realNameAppUrl ? <QRCodeSVG value={realNameAppUrl} size={220} /> : null}
          <Typography.Text type='tertiary'>
            {t('若页面未自动拉起支付宝，请使用支付宝扫描此二维码。')}
          </Typography.Text>
        </div>
      </Modal>
    </Card>
  );
};

export default AccountManagement;
