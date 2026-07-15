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

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Button,
  Card,
  Input,
  Modal,
  Space,
  Table,
  Tag,
  TextArea,
  Typography,
} from '@douyinfe/semi-ui';
import { useTranslation } from 'react-i18next';
import { API, showError, showSuccess, timestamp2string } from '../../helpers';

const DEFAULT_PAGE_SIZE = 10;

const tsToReadable = (ts) => {
  const n = Number(ts || 0);
  if (!n) return '—';
  const sec = n > 1e12 ? Math.floor(n / 1000) : n;
  return timestamp2string(sec);
};

const statusColor = (s) => {
  switch (s) {
    case 'pending':
      return 'orange';
    case 'approved':
      return 'blue';
    case 'rejected':
      return 'red';
    case 'paid':
      return 'green';
    default:
      return 'grey';
  }
};

export default function ResellerWithdrawalReview() {
  const { t } = useTranslation();

  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [actionId, setActionId] = useState(0);

  const [rejectVisible, setRejectVisible] = useState(false);
  const [rejectRemark, setRejectRemark] = useState('');
  const [rejectId, setRejectId] = useState(0);
  const [rejectSubmitting, setRejectSubmitting] = useState(false);

  const [paidVisible, setPaidVisible] = useState(false);
  const [paidId, setPaidId] = useState(0);
  const [paymentRef, setPaymentRef] = useState('');
  const [paidRemark, setPaidRemark] = useState('');
  const [paidSubmitting, setPaidSubmitting] = useState(false);

  const loadList = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        p: String(page),
        page_size: String(pageSize),
      });
      const res = await API.get(
        `/api/admin/reseller/withdrawals?${params.toString()}`,
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
  }, [page, pageSize, t]);

  useEffect(() => {
    loadList();
  }, [loadList]);

  const openReject = (id) => {
    setRejectId(id);
    setRejectRemark('');
    setRejectVisible(true);
  };

  const submitReject = async () => {
    if (!rejectId) return;
    setRejectSubmitting(true);
    try {
      const q =
        rejectRemark.trim() !== ''
          ? `?remark=${encodeURIComponent(rejectRemark.trim())}`
          : '';
      const res = await API.post(
        `/api/admin/reseller/withdrawals/${rejectId}/reject${q}`,
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
      title: t('确认通过该提现申请？'),
      content: t('通过后需再标记「已打款」完成闭环。'),
      onOk: async () => {
        setActionId(id);
        try {
          const res = await API.post(
            `/api/admin/reseller/withdrawals/${id}/approve`,
          );
          if (!res.data?.success) {
            showError(res.data?.message || t('操作失败'));
            return;
          }
          showSuccess(t('已通过'));
          await loadList();
        } catch (e) {
          showError(e.response?.data?.message || e.message || t('操作失败'));
        } finally {
          setActionId(0);
        }
      },
    });
  };

  const openPaid = (id) => {
    setPaidId(id);
    setPaymentRef('');
    setPaidRemark('');
    setPaidVisible(true);
  };

  const submitPaid = async () => {
    if (!paidId) return;
    setPaidSubmitting(true);
    try {
      const res = await API.post(
        `/api/admin/reseller/withdrawals/${paidId}/paid`,
        {
          payment_ref: paymentRef.trim(),
          remark: paidRemark.trim(),
        },
      );
      if (!res.data?.success) {
        showError(res.data?.message || t('操作失败'));
        return;
      }
      showSuccess(t('已标记打款'));
      setPaidVisible(false);
      await loadList();
    } catch (e) {
      showError(e.response?.data?.message || e.message || t('操作失败'));
    } finally {
      setPaidSubmitting(false);
    }
  };

  const columns = useMemo(
    () => [
      { title: 'ID', dataIndex: 'id', width: 72 },
      {
        title: t('分销商 ID'),
        dataIndex: 'reseller_id',
        width: 96,
      },
      { title: 'User ID', dataIndex: 'user_id', width: 88 },
      { title: t('金额'), dataIndex: 'amount', width: 100 },
      {
        title: t('状态'),
        dataIndex: 'status',
        width: 100,
        render: (s) => <Tag color={statusColor(s)}>{s}</Tag>,
      },
      {
        title: t('收款账户'),
        dataIndex: 'account',
        ellipsis: true,
      },
      {
        title: t('备注'),
        dataIndex: 'remark',
        width: 140,
        ellipsis: true,
      },
      {
        title: t('创建时间'),
        dataIndex: 'created_at',
        width: 172,
        render: (v) => tsToReadable(v),
      },
      {
        title: t('操作'),
        key: 'actions',
        width: 220,
        render: (_v, record) => {
          const id = record.id;
          const busy = actionId === id;
          return (
            <Space>
              {record.status === 'pending' && (
                <>
                  <Button
                    size='small'
                    theme='solid'
                    type='primary'
                    loading={busy}
                    onClick={() => approve(id)}
                  >
                    {t('通过')}
                  </Button>
                  <Button
                    size='small'
                    type='danger'
                    onClick={() => openReject(id)}
                  >
                    {t('驳回')}
                  </Button>
                </>
              )}
              {record.status === 'approved' && (
                <Button size='small' theme='solid' onClick={() => openPaid(id)}>
                  {t('标记已打款')}
                </Button>
              )}
            </Space>
          );
        },
      },
    ],
    [t, actionId],
  );

  return (
    <div
      className='mt-[60px] px-2 reseller-withdrawal-review-page'
      style={{ minHeight: 'calc(100vh - 140px)' }}
    >
      <Card className='table-scroll-card'>
        <Space vertical align='start' spacing={16} style={{ width: '100%' }}>
          <Typography.Title heading={4} style={{ margin: 0 }}>
            {t('分销商提现审核')}
          </Typography.Title>
          <Typography.Paragraph type='tertiary' style={{ margin: 0 }}>
            {t('审核分销商提现申请，通过后可标记打款完成')}
          </Typography.Paragraph>

          <Table
            loading={loading}
            columns={columns}
            dataSource={rows}
            pagination={{
              currentPage: page,
              pageSize,
              total,
              showSizeChanger: true,
              pageSizeOpts: [10, 20, 50],
              onPageChange: (cp) => setPage(cp),
              onPageSizeChange: (ps) => {
                setPageSize(ps);
                setPage(1);
              },
            }}
          />
        </Space>
      </Card>

      <Modal
        title={t('驳回原因')}
        visible={rejectVisible}
        onOk={submitReject}
        onCancel={() => setRejectVisible(false)}
        confirmLoading={rejectSubmitting}
        okText={t('确认驳回')}
      >
        <TextArea
          rows={3}
          value={rejectRemark}
          onChange={setRejectRemark}
          placeholder={t('可选')}
        />
      </Modal>

      <Modal
        title={t('标记已打款')}
        visible={paidVisible}
        onOk={submitPaid}
        onCancel={() => setPaidVisible(false)}
        confirmLoading={paidSubmitting}
        okText={t('确认')}
      >
        <Space vertical align='start' spacing={8} style={{ width: '100%' }}>
          <Typography.Text type='secondary' size='small'>
            {t('打款凭证 / 流水号')}
          </Typography.Text>
          <Input
            value={paymentRef}
            onChange={setPaymentRef}
            placeholder={t('可选')}
          />
          <Typography.Text type='secondary' size='small'>
            {t('备注')}
          </Typography.Text>
          <TextArea
            rows={2}
            value={paidRemark}
            onChange={setPaidRemark}
            placeholder={t('可选')}
          />
        </Space>
      </Modal>
    </div>
  );
}
