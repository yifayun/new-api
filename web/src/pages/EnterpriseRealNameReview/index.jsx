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

import React, { useCallback, useEffect, useState } from 'react';
import {
  Tabs,
  Table,
  Button,
  Space,
  Modal,
  Typography,
  Tag,
  Spin,
} from '@douyinfe/semi-ui';
import { useTranslation } from 'react-i18next';
import { API, showError, showSuccess } from '../../helpers';

const maskIdCard = (idCard) => {
  const s = String(idCard || '').trim();
  if (s.length < 8) return s || '—';
  return `${s.slice(0, 4)}****${s.slice(-4)}`;
};

const EnterpriseRealNameReview = () => {
  const { t } = useTranslation();
  const [tab, setTab] = useState('enterprise_pending');
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [detailVisible, setDetailVisible] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailUser, setDetailUser] = useState(null);
  const [actionLoadingId, setActionLoadingId] = useState(0);

  const loadList = useCallback(async () => {
    setLoading(true);
    try {
      const res = await API.get(
        `/api/user/enterprise-review?status=${encodeURIComponent(tab)}&p=${page}&page_size=${pageSize}`,
      );
      if (!res.data?.success) {
        showError(res.data?.message || t('加载失败'));
        return;
      }
      const data = res.data.data || {};
      setRows(Array.isArray(data.items) ? data.items : []);
      setTotal(Number(data.total) || 0);
    } catch (e) {
      showError(e.response?.data?.message || e.message || t('加载失败'));
    } finally {
      setLoading(false);
    }
  }, [tab, page, pageSize, t]);

  useEffect(() => {
    loadList();
  }, [loadList]);

  const openDetail = async (userId) => {
    setDetailVisible(true);
    setDetailLoading(true);
    setDetailUser(null);
    try {
      const res = await API.get(`/api/user/${userId}`);
      if (res.data?.success) {
        setDetailUser(res.data.data || null);
      } else {
        showError(res.data?.message || t('加载失败'));
      }
    } catch (e) {
      showError(e.response?.data?.message || e.message || t('加载失败'));
    } finally {
      setDetailLoading(false);
    }
  };

  const review = async (userId, action) => {
    const remark = window.prompt(
      action === 'approve' ? t('审核备注（可选）') : t('驳回原因（可选）'),
      '',
    );
    if (remark === null) return;
    setActionLoadingId(userId);
    try {
      const res = await API.post(
        `/api/user/${userId}/realname/company/${action}`,
        { remark },
      );
      if (!res.data?.success) {
        showError(res.data?.message || t('操作失败'));
        return;
      }
      showSuccess(action === 'approve' ? t('审核通过成功') : t('驳回成功'));
      setDetailVisible(false);
      await loadList();
    } catch (e) {
      showError(e.response?.data?.message || e.message || t('操作失败'));
    } finally {
      setActionLoadingId(0);
    }
  };

  const licenseSrc = detailUser?.real_name_business_license_image;
  const showLicenseImage =
    typeof licenseSrc === 'string' &&
    (licenseSrc.startsWith('data:') || /^https?:\/\//i.test(licenseSrc));

  const columns = [
    { title: 'ID', dataIndex: 'id', width: 72 },
    { title: t('用户名'), dataIndex: 'username', ellipsis: true },
    { title: t('显示名称'), dataIndex: 'display_name', ellipsis: true },
    { title: t('企业名称'), dataIndex: 'real_name_company_name', ellipsis: true },
    { title: t('企业税号'), dataIndex: 'real_name_company_tax_no', width: 140 },
    { title: t('姓名'), dataIndex: 'real_name_name', width: 100 },
    {
      title: t('身份证号'),
      dataIndex: 'real_name_id_card',
      width: 140,
      render: (v) => maskIdCard(v),
    },
    {
      title: t('状态'),
      dataIndex: 'real_name_status',
      width: 110,
      render: (v) =>
        v === 'enterprise_pending' ? (
          <Tag color='blue'>{t('企业待审')}</Tag>
        ) : (
          <Tag color='red'>{t('企业驳回')}</Tag>
        ),
    },
    {
      title: t('操作'),
      key: 'actions',
      width: 280,
      render: (_, record) => (
        <Space>
          <Button size='small' onClick={() => openDetail(record.id)}>
            {t('查看详情')}
          </Button>
          {record.real_name_status === 'enterprise_pending' ? (
            <>
              <Button
                type='primary'
                theme='solid'
                size='small'
                loading={actionLoadingId === record.id}
                onClick={() => review(record.id, 'approve')}
              >
                {t('通过')}
              </Button>
              <Button
                type='danger'
                theme='solid'
                size='small'
                loading={actionLoadingId === record.id}
                onClick={() => review(record.id, 'reject')}
              >
                {t('驳回')}
              </Button>
            </>
          ) : null}
        </Space>
      ),
    },
  ];

  return (
    <div className='mt-[60px] px-2'>
      <Typography.Title heading={4} className='mb-4'>
        {t('企业实名审核')}
      </Typography.Title>
      <Typography.Paragraph type='tertiary' className='mb-4'>
        {t('审核待处理的企业实名申请；列表不包含营业执照大图，请在详情中查看。')}
      </Typography.Paragraph>

      <Tabs
        type='button'
        activeKey={tab}
        onChange={(k) => {
          setTab(k);
          setPage(1);
        }}
      >
        <Tabs.TabPane tab={t('待审核')} itemKey='enterprise_pending' />
        <Tabs.TabPane tab={t('已驳回')} itemKey='enterprise_rejected' />
      </Tabs>

      <div className='mt-4'>
        <Table
          columns={columns}
          dataSource={rows}
          loading={loading}
          pagination={{
            currentPage: page,
            pageSize,
            total,
            pageSizeOpts: [10, 20, 50],
            onPageChange: (p) => setPage(p),
            onPageSizeChange: (s) => {
              setPageSize(s);
              setPage(1);
            },
            showSizeChanger: true,
          }}
          rowKey='id'
        />
      </div>

      <Modal
        title={t('企业实名详情')}
        visible={detailVisible}
        onCancel={() => setDetailVisible(false)}
        footer={null}
        width={720}
      >
        {detailLoading ? (
          <div className='flex justify-center py-8'>
            <Spin />
          </div>
        ) : detailUser ? (
          <div className='space-y-3 text-sm'>
            <div>
              <Typography.Text strong>ID</Typography.Text>：{detailUser.id}
            </div>
            <div>
              <Typography.Text strong>{t('用户名')}</Typography.Text>：
              {detailUser.username}
            </div>
            <div>
              <Typography.Text strong>{t('邮箱')}</Typography.Text>：
              {detailUser.email || '—'}
            </div>
            <div>
              <Typography.Text strong>{t('企业名称')}</Typography.Text>：
              {detailUser.real_name_company_name || '—'}
            </div>
            <div>
              <Typography.Text strong>{t('企业税号')}</Typography.Text>：
              {detailUser.real_name_company_tax_no || '—'}
            </div>
            <div>
              <Typography.Text strong>{t('姓名')}</Typography.Text>：
              {detailUser.real_name_name || '—'}
            </div>
            <div>
              <Typography.Text strong>{t('身份证号')}</Typography.Text>：
              {detailUser.real_name_id_card || '—'}
            </div>
            <div>
              <Typography.Text strong>{t('状态')}</Typography.Text>：
              {detailUser.real_name_status}
            </div>
            {detailUser.real_name_manual_review_remark ? (
              <div>
                <Typography.Text strong>{t('审核备注')}</Typography.Text>：
                {detailUser.real_name_manual_review_remark}
              </div>
            ) : null}
            <div>
              <Typography.Text strong>{t('营业执照')}</Typography.Text>
              {showLicenseImage ? (
                <div className='mt-2'>
                  <img
                    src={licenseSrc}
                    alt='license'
                    className='max-w-full max-h-[360px] rounded border border-gray-200'
                  />
                </div>
              ) : (
                <Typography.Paragraph type='tertiary' className='mt-1'>
                  {licenseSrc
                    ? t('非图片链接或格式较长，请复制字段自行查看')
                    : t('未上传')}
                </Typography.Paragraph>
              )}
            </div>
            {detailUser.real_name_status === 'enterprise_pending' ? (
              <Space className='mt-4'>
                <Button
                  type='primary'
                  theme='solid'
                  loading={actionLoadingId === detailUser.id}
                  onClick={() => review(detailUser.id, 'approve')}
                >
                  {t('通过')}
                </Button>
                <Button
                  type='danger'
                  theme='solid'
                  loading={actionLoadingId === detailUser.id}
                  onClick={() => review(detailUser.id, 'reject')}
                >
                  {t('驳回')}
                </Button>
              </Space>
            ) : null}
          </div>
        ) : null}
      </Modal>
    </div>
  );
};

export default EnterpriseRealNameReview;
