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
  Typography,
  Tag,
  Modal,
  TextArea,
} from '@douyinfe/semi-ui';
import { useTranslation } from 'react-i18next';
import { API, showError, showSuccess, timestamp2string } from '../../helpers';

const STATUS_TABS = [
  { key: 'pending', labelKey: '待审核' },
  { key: 'approved', labelKey: '已通过' },
  { key: 'rejected', labelKey: '已驳回' },
  { key: 'canceled', labelKey: '已取消' },
  { key: 'all', labelKey: '全部' },
];

export default function AccountDeleteReview() {
  const { t } = useTranslation();
  const [tab, setTab] = useState('pending');
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [actionId, setActionId] = useState(0);
  const [rejectVisible, setRejectVisible] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectTargetId, setRejectTargetId] = useState(0);
  const [rejectSubmitting, setRejectSubmitting] = useState(false);

  const loadList = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        p: String(page),
        page_size: String(pageSize),
      });
      if (tab && tab !== 'all') {
        params.set('status', tab);
      }
      const res = await API.get(`/api/user/delete_request?${params.toString()}`);
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
  }, [page, pageSize, tab, t]);

  useEffect(() => {
    loadList();
  }, [loadList]);

  const openReject = (id) => {
    setRejectTargetId(id);
    setRejectReason('');
    setRejectVisible(true);
  };

  const submitReject = async () => {
    if (!rejectTargetId) return;
    setRejectSubmitting(true);
    try {
      const res = await API.post(
        `/api/user/delete_request/${rejectTargetId}/reject`,
        { reason: rejectReason || '' },
      );
      if (!res.data?.success) {
        showError(res.data?.message || t('操作失败'));
        return;
      }
      showSuccess(t('已驳回'));
      setRejectVisible(false);
      await loadList();
    } catch (e) {
      showError(e.response?.data?.message || e.message || t('操作失败'));
    } finally {
      setRejectSubmitting(false);
    }
  };

  const approve = (id) => {
    Modal.confirm({
      title: t('确认通过注销申请？'),
      content: t('通过后该用户账号将被永久删除，且不可恢复。'),
      onOk: async () => {
        setActionId(id);
        try {
          const res = await API.post(
            `/api/user/delete_request/${id}/approve`,
            {},
          );
          if (!res.data?.success) {
            showError(res.data?.message || t('操作失败'));
            return;
          }
          showSuccess(t('已通过并注销用户'));
          await loadList();
        } catch (e) {
          showError(e.response?.data?.message || e.message || t('操作失败'));
        } finally {
          setActionId(0);
        }
      },
    });
  };

  const statusTag = (status) => {
    switch (status) {
      case 'pending':
        return <Tag color='blue'>{t('待审核')}</Tag>;
      case 'approved':
        return <Tag color='green'>{t('已通过')}</Tag>;
      case 'rejected':
        return <Tag color='red'>{t('已驳回')}</Tag>;
      case 'canceled':
        return <Tag color='grey'>{t('已取消')}</Tag>;
      default:
        return <Tag>{status || '—'}</Tag>;
    }
  };

  const columns = [
    { title: 'ID', dataIndex: 'id', width: 72 },
    { title: t('用户 ID'), dataIndex: 'user_id', width: 90 },
    { title: t('用户名'), dataIndex: 'username', ellipsis: true },
    {
      title: t('状态'),
      dataIndex: 'status',
      width: 100,
      render: (v) => statusTag(v),
    },
    {
      title: t('申请时间'),
      dataIndex: 'requested_at',
      width: 168,
      render: (v) => (v ? timestamp2string(Number(v)) : '—'),
    },
    {
      title: t('审核时间'),
      dataIndex: 'reviewed_at',
      width: 168,
      render: (v) => (v ? timestamp2string(Number(v)) : '—'),
    },
    { title: t('审核人'), dataIndex: 'reviewer_name', width: 120 },
    {
      title: t('备注/原因'),
      dataIndex: 'reason',
      ellipsis: true,
      render: (v) => v || '—',
    },
    {
      title: t('操作'),
      key: 'actions',
      width: 200,
      render: (_, record) =>
        record.status === 'pending' ? (
          <Space>
            <Button
              type='primary'
              theme='solid'
              size='small'
              loading={actionId === record.id}
              onClick={() => approve(record.id)}
            >
              {t('通过')}
            </Button>
            <Button
              type='danger'
              theme='solid'
              size='small'
              loading={actionId === record.id}
              onClick={() => openReject(record.id)}
            >
              {t('驳回')}
            </Button>
          </Space>
        ) : (
          '—'
        ),
    },
  ];

  return (
    <div className='mt-[60px] px-2'>
      <Typography.Title heading={4} className='mb-4'>
        {t('注销审核')}
      </Typography.Title>
      <Typography.Paragraph type='tertiary' className='mb-4'>
        {t('审核用户提交的账号注销申请；通过后将从系统中删除该用户。')}
      </Typography.Paragraph>

      <Tabs
        type='button'
        activeKey={tab}
        onChange={(k) => {
          setTab(k);
          setPage(1);
        }}
      >
        {STATUS_TABS.map(({ key, labelKey }) => (
          <Tabs.TabPane tab={t(labelKey)} itemKey={key} key={key} />
        ))}
      </Tabs>

      <Table
        className='mt-4'
        loading={loading}
        columns={columns}
        dataSource={rows}
        pagination={{
          currentPage: page,
          pageSize,
          total,
          showSizeChanger: true,
          pageSizeOpts: [10, 20, 50],
          onPageChange: (p) => setPage(p),
          onPageSizeChange: (s) => {
            setPageSize(s);
            setPage(1);
          },
        }}
      />

      <Modal
        title={t('驳回原因')}
        visible={rejectVisible}
        onOk={submitReject}
        onCancel={() => setRejectVisible(false)}
        okText={t('提交')}
        cancelText={t('取消')}
        confirmLoading={rejectSubmitting}
      >
        <TextArea
          value={rejectReason}
          onChange={setRejectReason}
          placeholder={t('选填，将记录到申请记录中')}
          rows={3}
        />
      </Modal>
    </div>
  );
}
