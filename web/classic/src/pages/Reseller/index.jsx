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
  InputNumber,
  Space,
  Table,
  Typography,
} from '@douyinfe/semi-ui';
import { useTranslation } from 'react-i18next';
import { API, showError, showSuccess, timestamp2string } from '../../helpers';

const INITIAL_PAGE_SIZE = 10;

const tsToReadable = (ts) => {
  const n = Number(ts || 0);
  if (!n) return '—';
  const sec = n > 1e12 ? Math.floor(n / 1000) : n;
  return timestamp2string(sec);
};

export default function Reseller() {
  const { t } = useTranslation();

  const [profileLoading, setProfileLoading] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);

  const [profileForm, setProfileForm] = useState({
    host: '',
    logo: '',
    site_name: '',
    name: '',
    markup_rate: 0,
  });

  const [profitSummary, setProfitSummary] = useState(null);

  const [amount, setAmount] = useState(null);
  const [account, setAccount] = useState('');
  const [withdrawRemark, setWithdrawRemark] = useState('');
  const [withdrawSubmitting, setWithdrawSubmitting] = useState(false);

  const [profitRecords, setProfitRecords] = useState([]);
  const [profitTotal, setProfitTotal] = useState(0);
  const [profitPage, setProfitPage] = useState(1);
  const [profitPageSize, setProfitPageSize] = useState(INITIAL_PAGE_SIZE);
  const [profitLoading, setProfitLoading] = useState(false);
  const [profitUserFilter, setProfitUserFilter] = useState('');

  const [userRows, setUserRows] = useState([]);
  const [userTotal, setUserTotal] = useState(0);
  const [userPage, setUserPage] = useState(1);
  const [userPageSize, setUserPageSize] = useState(INITIAL_PAGE_SIZE);
  const [usersLoading, setUsersLoading] = useState(false);

  const [wdRows, setWdRows] = useState([]);
  const [wdTotal, setWdTotal] = useState(0);
  const [wdPage, setWdPage] = useState(1);
  const [wdPageSize, setWdPageSize] = useState(INITIAL_PAGE_SIZE);
  const [wdLoading, setWdLoading] = useState(false);

  const loadProfileAndProfit = useCallback(async () => {
    setProfileLoading(true);
    try {
      const [pRes, sRes] = await Promise.all([
        API.get('/api/reseller/profile'),
        API.get('/api/reseller/profit'),
      ]);
      if (!pRes.data?.success) {
        showError(pRes.data?.message || t('加载失败'));
        return;
      }
      if (!sRes.data?.success) {
        showError(sRes.data?.message || t('加载失败'));
        return;
      }
      const p = pRes.data.data || {};
      setProfileForm({
        host: p.host || '',
        logo: p.logo || '',
        site_name: p.site_name || '',
        name: p.name || '',
        markup_rate:
          typeof p.markup_rate === 'number' ? p.markup_rate : Number(p.markup_rate || 0),
      });
      setProfitSummary(sRes.data.data || null);
    } catch (e) {
      showError(e.response?.data?.message || e.message || t('加载失败'));
    } finally {
      setProfileLoading(false);
    }
  }, [t]);

  const loadProfitRecords = useCallback(
    async (page, ps) => {
      setProfitLoading(true);
      try {
        const params = new URLSearchParams({
          p: String(page),
          page_size: String(ps),
        });
        const uid = String(profitUserFilter || '').trim();
        if (uid && !Number.isNaN(Number(uid))) {
          params.set('user_id', uid);
        }
        const res = await API.get(
          `/api/reseller/profit/records?${params.toString()}`,
        );
        if (!res.data?.success) {
          showError(res.data?.message || t('加载失败'));
          return;
        }
        const data = res.data.data || {};
        setProfitRecords(Array.isArray(data.items) ? data.items : []);
        setProfitTotal(Number(data.total) || 0);
      } catch (e) {
        showError(e.response?.data?.message || e.message || t('加载失败'));
      } finally {
        setProfitLoading(false);
      }
    },
    [profitUserFilter, t],
  );

  const loadUsers = useCallback(
    async (page, pageSize) => {
      setUsersLoading(true);
      try {
        const params = new URLSearchParams({
          p: String(page),
          page_size: String(pageSize),
        });
        const res = await API.get(`/api/reseller/users?${params.toString()}`);
        if (!res.data?.success) {
          showError(res.data?.message || t('加载失败'));
          return;
        }
        const data = res.data.data || {};
        setUserRows(Array.isArray(data.items) ? data.items : []);
        setUserTotal(Number(data.total) || 0);
      } catch (e) {
        showError(e.response?.data?.message || e.message || t('加载失败'));
      } finally {
        setUsersLoading(false);
      }
    },
    [t],
  );

  const loadWithdrawals = useCallback(
    async (page, pageSize) => {
      setWdLoading(true);
      try {
        const params = new URLSearchParams({
          p: String(page),
          page_size: String(pageSize),
        });
        const res = await API.get(
          `/api/reseller/withdrawals?${params.toString()}`,
        );
        if (!res.data?.success) {
          showError(res.data?.message || t('加载失败'));
          return;
        }
        const data = res.data.data || {};
        setWdRows(Array.isArray(data.items) ? data.items : []);
        setWdTotal(Number(data.total) || 0);
      } catch (e) {
        showError(e.response?.data?.message || e.message || t('加载失败'));
      } finally {
        setWdLoading(false);
      }
    },
    [t],
  );

  useEffect(() => {
    loadProfileAndProfit();
  }, [loadProfileAndProfit]);

  useEffect(() => {
    loadProfitRecords(profitPage, profitPageSize);
  }, [
    profitPage,
    profitPageSize,
    profitUserFilter,
    loadProfitRecords,
  ]);

  useEffect(() => {
    loadUsers(userPage, userPageSize);
  }, [userPage, userPageSize, loadUsers]);

  useEffect(() => {
    loadWithdrawals(wdPage, wdPageSize);
  }, [wdPage, wdPageSize, loadWithdrawals]);

  const saveProfile = async () => {
    setSavingProfile(true);
    try {
      const payload = {
        host: profileForm.host,
        logo: profileForm.logo,
        site_name: profileForm.site_name,
        name: profileForm.name,
        markup_rate: Number(profileForm.markup_rate ?? 0),
      };
      const res = await API.put('/api/reseller/profile', payload);
      if (!res.data?.success) {
        showError(res.data?.message || t('保存失败'));
        return;
      }
      showSuccess(t('保存成功'));
      await loadProfileAndProfit();
    } catch (e) {
      showError(e.response?.data?.message || e.message || t('保存失败'));
    } finally {
      setSavingProfile(false);
    }
  };

  const submitWithdrawal = async () => {
    const amt = Number(amount);
    if (!amt || amt < 1) {
      showError(t('提现金额无效'));
      return;
    }
    const acc = String(account || '').trim();
    if (!acc) {
      showError(t('请填写收款账户'));
      return;
    }
    setWithdrawSubmitting(true);
    try {
      const res = await API.post('/api/reseller/withdrawals', {
        amount: amt,
        account: acc,
        remark: String(withdrawRemark || '').trim(),
      });
      if (!res.data?.success) {
        showError(res.data?.message || t('提交失败'));
        return;
      }
      showSuccess(t('提现申请已提交'));
      setAmount(null);
      setWithdrawRemark('');
      await loadProfileAndProfit();
      await loadWithdrawals(1, wdPageSize);
      setWdPage(1);
    } catch (e) {
      showError(e.response?.data?.message || e.message || t('提交失败'));
    } finally {
      setWithdrawSubmitting(false);
    }
  };

  const profitColumns = useMemo(
    () => [
      { title: 'ID', dataIndex: 'id', width: 72 },
      { title: 'User ID', dataIndex: 'user_id', width: 88 },
      { title: t('基础额度'), dataIndex: 'base_quota', width: 100 },
      { title: t('分润额度'), dataIndex: 'markup_quota', width: 100 },
      { title: t('加价率'), dataIndex: 'markup_rate', width: 88 },
      {
        title: t('时间'),
        dataIndex: 'created_at',
        width: 172,
        render: (v) => tsToReadable(v),
      },
    ],
    [t],
  );

  const userColumns = useMemo(
    () => [
      { title: 'ID', dataIndex: 'id', width: 72 },
      { title: t('用户名'), dataIndex: 'username', width: 140 },
      { title: t('电子邮件'), dataIndex: 'email', width: 200 },
      { title: t('手机号'), dataIndex: 'phone', width: 140 },
    ],
    [t],
  );

  const wdColumns = useMemo(
    () => [
      { title: 'ID', dataIndex: 'id', width: 72 },
      { title: t('金额'), dataIndex: 'amount', width: 100 },
      {
        title: t('状态'),
        dataIndex: 'status',
        width: 96,
      },
      { title: t('收款账户'), dataIndex: 'account', ellipsis: true },
      {
        title: t('时间'),
        dataIndex: 'created_at',
        width: 172,
        render: (v) => tsToReadable(v),
      },
    ],
    [t],
  );

  return (
    <div
      className='mt-[60px] px-2 reseller-center-page'
      style={{ minHeight: 'calc(100vh - 140px)' }}
    >
      <Card className='table-scroll-card'>
        <Space vertical align='start' spacing={16} style={{ width: '100%' }}>
          <Typography.Title heading={4} style={{ margin: 0 }}>
            {t('分销商中心')}
          </Typography.Title>
          <Typography.Paragraph type='tertiary' style={{ margin: 0 }}>
            {t('管理分站品牌、加价倍率与分润提现')}
          </Typography.Paragraph>

          <Space wrap spacing={24}>
            <Typography.Text strong>
              {t('今日分润')}：{profitSummary?.today_profit ?? '—'}
            </Typography.Text>
            <Typography.Text strong>
              {t('累计分润')}：{profitSummary?.total_profit ?? '—'}
            </Typography.Text>
            <Typography.Text strong>
              {t('可提现余额')}：{profitSummary?.withdrawable ?? '—'}
            </Typography.Text>
            <Typography.Text strong>
              {t('处理中提现')}：{profitSummary?.pending_withdrawal ?? '—'}
            </Typography.Text>
          </Space>

          <Card
            title={t('分站资料')}
            style={{ width: '100%' }}
            loading={profileLoading}
          >
            <Space vertical align='start' spacing={12}>
              <Space wrap>
                <Input
                  style={{ width: 200 }}
                  placeholder={t('站点名称')}
                  value={profileForm.site_name}
                  onChange={(v) =>
                    setProfileForm((prev) => ({ ...prev, site_name: v }))
                  }
                />
                <Input
                  style={{ width: 200 }}
                  placeholder={t('分销商名称')}
                  value={profileForm.name}
                  onChange={(v) =>
                    setProfileForm((prev) => ({ ...prev, name: v }))
                  }
                />
              </Space>
              <Space wrap>
                <Input
                  style={{ width: 280 }}
                  placeholder={t('绑定域名')}
                  value={profileForm.host}
                  onChange={(v) =>
                    setProfileForm((prev) => ({ ...prev, host: v }))
                  }
                />
                <Input
                  style={{ width: 360 }}
                  placeholder={t('Logo 地址')}
                  value={profileForm.logo}
                  onChange={(v) =>
                    setProfileForm((prev) => ({ ...prev, logo: v }))
                  }
                />
              </Space>
              <Space>
                <Typography.Text type='secondary' size='small'>
                  {t('平台加价增量')}
                </Typography.Text>
                <InputNumber
                  min={0}
                  step={0.01}
                  value={profileForm.markup_rate}
                  onChange={(v) => {
                    const n =
                      v === '' || v == null
                        ? 0
                        : typeof v === 'number'
                          ? v
                          : Number(v);
                    setProfileForm((prev) => ({
                      ...prev,
                      markup_rate: Number.isNaN(n) ? 0 : n,
                    }));
                  }}
                />
              </Space>
              <Button
                theme='solid'
                type='primary'
                loading={savingProfile}
                onClick={saveProfile}
              >
                {t('保存')}
              </Button>
            </Space>
          </Card>

          <Card title={t('申请提现')} style={{ width: '100%' }}>
            <Space vertical align='start' spacing={8}>
              <Space wrap>
                <InputNumber
                  min={1}
                  placeholder={t('提现额度')}
                  value={amount}
                  onChange={(v) => {
                    setAmount(v === '' || v == null ? null : Number(v));
                  }}
                />
                <Input
                  style={{ width: 280 }}
                  placeholder={t('收款账户')}
                  value={account}
                  onChange={setAccount}
                />
              </Space>
              <Input
                style={{ maxWidth: 480 }}
                placeholder={t('备注可选')}
                value={withdrawRemark}
                onChange={setWithdrawRemark}
              />
              <Button
                theme='solid'
                type='primary'
                loading={withdrawSubmitting}
                onClick={submitWithdrawal}
              >
                {t('提交申请')}
              </Button>
            </Space>
          </Card>

          <Card title={t('分润明细')} style={{ width: '100%' }}>
              <Space style={{ marginBottom: 12 }} wrap>
              <Input
                placeholder={t('按用户 ID 筛选')}
                value={profitUserFilter}
                onChange={setProfitUserFilter}
                style={{ width: 160 }}
              />
              <Button theme='solid' onClick={() => setProfitPage(1)}>
                {t('查询')}
              </Button>
            </Space>
            <Table
              loading={profitLoading}
              columns={profitColumns}
              dataSource={profitRecords}
              pagination={{
                currentPage: profitPage,
                pageSize: profitPageSize,
                total: profitTotal,
                showSizeChanger: true,
                pageSizeOpts: [10, 20, 50],
                onPageChange: (cp) => setProfitPage(cp),
                onPageSizeChange: (ps) => {
                  setProfitPageSize(ps);
                  setProfitPage(1);
                },
              }}
            />
          </Card>

          <Card title={t('分站用户')} style={{ width: '100%' }}>
            <Table
              loading={usersLoading}
              columns={userColumns}
              dataSource={userRows}
              pagination={{
                currentPage: userPage,
                pageSize: userPageSize,
                total: userTotal,
                showSizeChanger: true,
                pageSizeOpts: [10, 20, 50],
                onPageChange: (cp) => setUserPage(cp),
                onPageSizeChange: (ps) => {
                  setUserPageSize(ps);
                  setUserPage(1);
                },
              }}
            />
          </Card>

          <Card title={t('提现记录')} style={{ width: '100%' }}>
            <Table
              loading={wdLoading}
              columns={wdColumns}
              dataSource={wdRows}
              pagination={{
                currentPage: wdPage,
                pageSize: wdPageSize,
                total: wdTotal,
                showSizeChanger: true,
                pageSizeOpts: [10, 20, 50],
                onPageChange: (cp) => setWdPage(cp),
                onPageSizeChange: (ps) => {
                  setWdPageSize(ps);
                  setWdPage(1);
                },
              }}
            />
          </Card>
        </Space>
      </Card>
    </div>
  );
}
