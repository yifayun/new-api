import React, { useEffect, useState } from 'react';
import {
  Button,
  Card,
  Form,
  Typography,
  Tag,
  Modal,
  RadioGroup,
  Radio,
} from '@douyinfe/semi-ui';
import { useNavigate, useLocation } from 'react-router-dom';
import { API, showError, showSuccess } from '../../helpers';
import { QRCodeSVG } from 'qrcode.react';

const RealNameGuide = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [loading, setLoading] = useState(false);
  const [statusLoading, setStatusLoading] = useState(false);
  const [realNameStatus, setRealNameStatus] = useState('none');
  const [inputs, setInputs] = useState({
    real_name: '',
    id_card: '',
    real_name_type: 'personal',
    company_name: '',
    company_tax_no: '',
    business_license_image: '',
  });
  const [showQrModal, setShowQrModal] = useState(false);
  const [realNameAppUrl, setRealNameAppUrl] = useState('');
  const [requiredPayment, setRequiredPayment] = useState(0);
  const [paidTotal, setPaidTotal] = useState(0);

  const getRealNameStatusLabel = (status) => {
    const statusMap = {
      none: '未认证',
      pending: '认证中',
      passed: '已通过',
      rejected: '未通过',
      enterprise_pending: '企业待审核',
      enterprise_rejected: '企业审核驳回',
    };
    return statusMap[status] || status;
  };

  const updateLocalUserState = async () => {
    try {
      const res = await API.get('/api/user/self');
      if (res.data.success) {
        const user = res.data.data || {};
        const raw = localStorage.getItem('user');
        const oldUser = raw ? JSON.parse(raw) : {};
        const merged = { ...oldUser, ...user };
        localStorage.setItem('user', JSON.stringify(merged));
        return merged;
      }
    } catch (e) {
      // ignore
    }
    return null;
  };

  const refreshStatus = async (showToast = false) => {
    setStatusLoading(true);
    try {
      const res = await API.post('/api/user/realname/refresh');
      if (!res.data.success) {
        showError(res.data.message || '刷新实名认证状态失败');
        return;
      }
      const status = res.data?.data?.real_name_status || 'pending';
      const currentType = res.data?.data?.real_name_type || 'personal';
      setRealNameStatus(status);
      setInputs((prev) => ({
        ...prev,
        real_name_type: currentType === 'enterprise' ? 'enterprise' : prev.real_name_type,
      }));
      setRequiredPayment(Number(res.data?.data?.realname_required_payment || 0));
      setPaidTotal(Number(res.data?.data?.realname_paid_total || 0));
      const user = await updateLocalUserState();
      if (user?.real_name_verified) {
        showSuccess('实名认证已通过');
        const fromPath = location.state?.from?.pathname;
        navigate(
          fromPath && fromPath !== '/realname-required' ? fromPath : '/console',
          {
            replace: true,
          },
        );
        return;
      }
      if (showToast) {
        showSuccess('实名认证状态已更新');
      }
    } catch (error) {
      showError(
        error.response?.data?.message ||
          error.message ||
          '刷新实名认证状态失败',
      );
    } finally {
      setStatusLoading(false);
    }
  };

  const fetchInitialStatus = async () => {
    setStatusLoading(true);
    try {
      const res = await API.get('/api/user/realname/status');
      if (res.data.success) {
        const status = res.data?.data?.real_name_status || 'none';
        const currentType = res.data?.data?.real_name_type || 'personal';
        setRealNameStatus(status);
        setInputs((prev) => ({
          ...prev,
          real_name_type: currentType,
        }));
        setRequiredPayment(
          Number(res.data?.data?.realname_required_payment || 0),
        );
        setPaidTotal(Number(res.data?.data?.realname_paid_total || 0));
        await updateLocalUserState();
      }
    } catch (e) {
      // ignore
    } finally {
      setStatusLoading(false);
    }
  };

  useEffect(() => {
    fetchInitialStatus();
  }, []);

  useEffect(() => {
    if (realNameStatus !== 'pending') {
      return;
    }
    const timer = setInterval(() => {
      refreshStatus(false);
    }, 5000);
    return () => clearInterval(timer);
  }, [realNameStatus]);

  const startRealName = async () => {
    if (!inputs.real_name || !inputs.id_card) {
      showError('请填写真实姓名和身份证号');
      return;
    }
    if (inputs.real_name_type === 'enterprise') {
      if (
        !inputs.company_name ||
        !inputs.company_tax_no ||
        !inputs.business_license_image
      ) {
        showError('企业实名需填写企业名称、企业税号并上传营业执照');
        return;
      }
    }
    setLoading(true);
    try {
      const res = await API.post('/api/user/realname/initiate', inputs);
      if (!res.data.success) {
        showError(res.data.message || '发起实名认证失败');
        return;
      }
      const certifyUrl = res.data?.data?.certify_url;
      const certifyAlipaysUrl = res.data?.data?.certify_alipays_url;
      const certifyForm = res.data?.data?.certify_form;
      setRealNameStatus(res.data?.data?.status || 'pending');
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
        setShowQrModal(true);
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
      showSuccess(
        inputs.real_name_type === 'enterprise'
          ? '企业实名已发起，请先完成支付宝扫脸，扫脸通过后会进入管理员审核'
          : '已发起实名认证，请在支付宝完成认证后刷新状态',
      );
    } catch (error) {
      showError(
        error.response?.data?.message || error.message || '发起实名认证失败',
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className='min-h-screen bg-gray-100 flex items-center justify-center px-4 py-10'>
      <Card className='w-full max-w-2xl !rounded-2xl'>
        <Typography.Title heading={3}>实名认证引导</Typography.Title>
        <Typography.Paragraph type='tertiary'>
          当前系统开启了实名认证，完成并通过认证后才可继续使用控制台和 API。
        </Typography.Paragraph>
        <Typography.Paragraph type='secondary'>
          支持个人认证升级为企业认证，不支持企业认证降级为个人认证。
        </Typography.Paragraph>
        <div className='mb-4'>
          当前状态：
          <Tag
            color={realNameStatus === 'passed' ? 'green' : 'blue'}
            className='ml-2'
          >
            {getRealNameStatusLabel(realNameStatus)}
          </Tag>
        </div>
        {realNameStatus === 'enterprise_pending' && (
          <Typography.Paragraph type='warning'>
            企业实名申请已提交，等待管理员手动审核通过。
          </Typography.Paragraph>
        )}
        {realNameStatus === 'enterprise_rejected' && (
          <Typography.Paragraph type='danger'>
            企业实名审核未通过，请核对资料后重新提交。
          </Typography.Paragraph>
        )}
        {requiredPayment > 0 && (
          <Typography.Paragraph type='warning'>
            实名认证通过后需至少充值 {requiredPayment.toFixed(2)} 元，当前已充值{' '}
            {paidTotal.toFixed(2)} 元。
          </Typography.Paragraph>
        )}

        <Form>
          <div className='mb-3'>
            <Typography.Text strong>实名类型</Typography.Text>
            <div className='mt-2'>
              <RadioGroup
                type='button'
                value={inputs.real_name_type}
                onChange={(e) => {
                  const nextType = e?.target?.value || 'personal';
                  if (
                    inputs.real_name_type === 'enterprise' &&
                    nextType === 'personal'
                  ) {
                    showError('不支持企业认证降级为个人认证');
                    return;
                  }
                  setInputs((prev) => ({
                    ...prev,
                    real_name_type: nextType,
                  }));
                }}
              >
                <Radio value='personal'>个人实名</Radio>
                <Radio value='enterprise'>企业实名</Radio>
              </RadioGroup>
            </div>
          </div>
          <Form.Input
            field='real_name'
            label='真实姓名'
            placeholder='请输入真实姓名'
            value={inputs.real_name}
            onChange={(value) =>
              setInputs((prev) => ({ ...prev, real_name: value }))
            }
          />
          <Form.Input
            field='id_card'
            label='身份证号'
            placeholder='请输入身份证号'
            value={inputs.id_card}
            onChange={(value) =>
              setInputs((prev) => ({ ...prev, id_card: value }))
            }
          />
          {inputs.real_name_type === 'enterprise' && (
            <>
              <Form.Input
                field='company_name'
                label='企业名称'
                placeholder='请输入企业名称'
                value={inputs.company_name}
                onChange={(value) =>
                  setInputs((prev) => ({ ...prev, company_name: value }))
                }
              />
              <Form.Input
                field='company_tax_no'
                label='企业税号'
                placeholder='请输入企业税号'
                value={inputs.company_tax_no}
                onChange={(value) =>
                  setInputs((prev) => ({ ...prev, company_tax_no: value }))
                }
              />
              <Form.Input
                field='business_license_image'
                label='营业执照（图片Base64或URL）'
                placeholder='可粘贴营业执照图片的 Base64 或 URL'
                value={inputs.business_license_image}
                onChange={(value) =>
                  setInputs((prev) => ({
                    ...prev,
                    business_license_image: value,
                  }))
                }
              />
              <div className='mb-3'>
                <Typography.Text type='tertiary'>
                  或者直接上传营业执照图片（会自动转为Base64提交）
                </Typography.Text>
                <input
                  type='file'
                  accept='image/*'
                  className='mt-2 block'
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const reader = new FileReader();
                    reader.onload = () => {
                      const base64 = reader.result;
                      if (typeof base64 === 'string') {
                        setInputs((prev) => ({
                          ...prev,
                          business_license_image: base64,
                        }));
                      }
                    };
                    reader.readAsDataURL(file);
                  }}
                />
              </div>
            </>
          )}
        </Form>

        <div className='flex flex-wrap gap-2 mt-4'>
          <Button type='primary' loading={loading} onClick={startRealName}>
            发起实名认证
          </Button>
          <Button loading={statusLoading} onClick={() => refreshStatus(true)}>
            刷新认证状态
          </Button>
          <Button theme='outline' onClick={() => navigate('/console/personal')}>
            前往个人设置
          </Button>
        </div>

        <div className='mt-8 border-t border-gray-200 pt-5'>
          <Typography.Title heading={5}>认证流程说明</Typography.Title>
          <Typography.Paragraph>
            1. 填写真实姓名和身份证号，点击“发起实名认证”。
          </Typography.Paragraph>
          <Typography.Paragraph>
            2. 系统会跳转到支付宝芝麻认证页面，请按指引完成人脸/身份校验。
          </Typography.Paragraph>
          <Typography.Paragraph>
            3. 完成后返回本页，点击“刷新认证状态”。
          </Typography.Paragraph>
          <Typography.Paragraph>
            4. 状态变为 <Tag color='green'>passed</Tag> 后即可正常访问系统。
          </Typography.Paragraph>
        </div>

        <div className='mt-4 border-t border-gray-200 pt-5'>
          <Typography.Title heading={5}>常见失败原因</Typography.Title>
          <Typography.Paragraph>
            - 姓名或身份证号填写错误，与公安实名信息不一致。
          </Typography.Paragraph>
          <Typography.Paragraph>
            - 支付宝账号未完成基础实名，导致芝麻认证无法继续。
          </Typography.Paragraph>
          <Typography.Paragraph>
            - 人脸识别环境问题（光线不足、镜头权限被禁用、网络波动）。
          </Typography.Paragraph>
          <Typography.Paragraph>
            - 认证完成后未点击“刷新认证状态”，页面仍显示旧状态。
          </Typography.Paragraph>
        </div>
      </Card>
      <Modal
        title='请使用支付宝扫码继续认证'
        visible={showQrModal}
        footer={null}
        onCancel={() => setShowQrModal(false)}
      >
        <div className='flex flex-col items-center gap-3'>
          {realNameAppUrl ? <QRCodeSVG value={realNameAppUrl} size={220} /> : null}
          <Typography.Text type='tertiary'>
            若页面未自动拉起支付宝，请使用支付宝扫描此二维码。
          </Typography.Text>
        </div>
      </Modal>
    </div>
  );
};

export default RealNameGuide;
