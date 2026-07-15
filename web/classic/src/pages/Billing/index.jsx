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

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Button,
  Card,
  DatePicker,
  Input,
  Space,
  Table,
  Typography,
} from '@douyinfe/semi-ui';
import { IconDownload, IconSearch } from '@douyinfe/semi-icons';
import { useTranslation } from 'react-i18next';
import { API, showError, showSuccess } from '../../helpers';

const DEFAULT_PAGE_SIZE = 20;
const DEFAULT_RANGE_DAYS = 30;

const formatUSD = (value) => {
  const num = Number(value || 0);
  return Number.isFinite(num) ? num.toFixed(6) : '0.000000';
};

const createDefaultDateRange = () => {
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  const start = new Date(end);
  start.setDate(start.getDate() - (DEFAULT_RANGE_DAYS - 1));
  start.setHours(0, 0, 0, 0);
  return [start, end];
};

const EMPTY_SUMMARY = {
  users: 0,
  records: 0,
  promptTokens: 0,
  completionTokens: 0,
  cacheReadTokens: 0,
  totalTokens: 0,
  consumedQuota: 0,
  estimatedCost: 0,
};

export default function Billing() {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [total, setTotal] = useState(0);
  const [keyword, setKeyword] = useState('');
  const [dateRange, setDateRange] = useState(() => createDefaultDateRange());
  const [summary, setSummary] = useState(EMPTY_SUMMARY);
  const requestSeqRef = useRef(0);

  const buildQueryParams = useCallback(
    (targetPage, targetPageSize, targetKeyword, targetDateRange) => {
      const params = {
        p: targetPage,
        page_size: targetPageSize,
      };
      if (targetKeyword.trim()) {
        params.keyword = targetKeyword.trim();
      }
      if (Array.isArray(targetDateRange) && targetDateRange.length === 2) {
        const [start, end] = targetDateRange;
        if (start && end) {
          params.start_timestamp = Math.floor(start.valueOf() / 1000);
          params.end_timestamp = Math.floor(end.valueOf() / 1000);
        }
      }
      return params;
    },
    [],
  );

  const fetchData = useCallback(
    async ({
      targetPage = page,
      targetPageSize = pageSize,
      targetKeyword = keyword,
      targetDateRange = dateRange,
    } = {}) => {
      const requestId = ++requestSeqRef.current;
      setLoading(true);
      try {
        const res = await API.get('/api/billing/user-models', {
          params: buildQueryParams(
            targetPage,
            targetPageSize,
            targetKeyword,
            targetDateRange,
          ),
        });
        if (requestId !== requestSeqRef.current) {
          return;
        }
        const payload = res.data;
        if (!payload?.success) {
          throw new Error(payload?.message || t('加载失败'));
        }
        const data = payload.data || {};
        const items = Array.isArray(data.items) ? data.items : [];
        const userSummary = Array.isArray(data.user_summary)
          ? data.user_summary
          : [];
        const grand = data.grand_total || {};
        const promptTokens = Number(grand.prompt_tokens || 0);
        const completionTokens = Number(grand.completion_tokens || 0);
        const cacheReadTokens = Number(grand.cache_read_tokens || 0);
        setRows(items);
        setTotal(Number(data.total || 0));
        setSummary({
          users: Number(data.user_count ?? userSummary.length ?? 0),
          records: Number(data.total || 0),
          promptTokens,
          completionTokens,
          cacheReadTokens,
          totalTokens: promptTokens + completionTokens,
          consumedQuota: Number(grand.consumed_quota || 0),
          estimatedCost: Number(grand.estimated_cost || 0),
        });
      } catch (error) {
        if (requestId === requestSeqRef.current) {
          showError(error);
        }
      } finally {
        if (requestId === requestSeqRef.current) {
          setLoading(false);
        }
      }
    },
    [buildQueryParams, dateRange, keyword, page, pageSize, t],
  );

  useEffect(() => {
    fetchData({
      targetPage: 1,
      targetPageSize: pageSize,
      targetKeyword: keyword,
      targetDateRange: dateRange,
    });
    setPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- initial load only
  }, []);

  const columns = useMemo(
    () => [
      { title: t('User ID'), dataIndex: 'user_id', width: 90 },
      { title: t('用户名'), dataIndex: 'username', width: 160 },
      { title: t('模型'), dataIndex: 'model_name', width: 220 },
      { title: t('请求数'), dataIndex: 'request_count', width: 100 },
      { title: t('Prompt'), dataIndex: 'prompt_tokens', width: 120 },
      { title: t('Completion'), dataIndex: 'completion_tokens', width: 120 },
      { title: t('Cache'), dataIndex: 'cache_read_tokens', width: 110 },
      { title: t('消耗额度'), dataIndex: 'consumed_quota', width: 120 },
      {
        title: t('预估费用(USD)'),
        dataIndex: 'estimated_cost',
        width: 130,
        render: (value) => formatUSD(value),
      },
    ],
    [t],
  );

  const handleSearch = async () => {
    setPage(1);
    await fetchData({
      targetPage: 1,
      targetPageSize: pageSize,
      targetKeyword: keyword,
      targetDateRange: dateRange,
    });
  };

  const handleExport = () => {
    try {
      const qp = buildQueryParams(1, pageSize, keyword, dateRange);
      const params = new URLSearchParams();
      Object.entries(qp).forEach(([key, val]) => {
        if (val !== undefined && val !== null && `${val}` !== '') {
          params.set(key, String(val));
        }
      });
      window.open(`/api/billing/user-models/export?${params}`, '_blank');
      showSuccess(t('已开始下载'));
    } catch (e) {
      showError(e);
    }
  };

  return (
    <div
      className='mt-[60px] px-2 billing-management-page'
      style={{ minHeight: 'calc(100vh - 140px)' }}
    >
      <Card className='table-scroll-card'>
        <Space vertical align='start' spacing={16} style={{ width: '100%' }}>
          <Typography.Title heading={4} style={{ margin: 0 }}>
            {t('账单管理')}
          </Typography.Title>
          <Typography.Paragraph type='tertiary' style={{ margin: 0 }}>
            {t(
              '按用户与模型聚合的调用账单；支持与系统「数据导出」相同的时间维度筛选。',
            )}
          </Typography.Paragraph>

          <Space wrap>
            <Input
              placeholder={t('按用户名/模型搜索')}
              value={keyword}
              onChange={setKeyword}
              onEnterPress={handleSearch}
              style={{ width: 260 }}
            />
            <DatePicker
              type='dateRange'
              density='compact'
              value={dateRange}
              onChange={setDateRange}
            />
            <Button icon={<IconSearch />} theme='solid' onClick={handleSearch}>
              {t('查询')}
            </Button>
            <Button icon={<IconDownload />} onClick={handleExport}>
              {t('导出 CSV')}
            </Button>
          </Space>

          <Space wrap>
            <Typography.Text strong>
              {t('用户数')}: {summary.users}
            </Typography.Text>
            <Typography.Text strong>
              {t('明细条数')}: {summary.records}
            </Typography.Text>
            <Typography.Text strong>
              {t('Total Tokens')}: {summary.totalTokens}
            </Typography.Text>
            <Typography.Text strong>
              {t('Prompt')}: {summary.promptTokens}
            </Typography.Text>
            <Typography.Text strong>
              {t('Completion')}: {summary.completionTokens}
            </Typography.Text>
            <Typography.Text strong>
              {t('Cache')}: {summary.cacheReadTokens}
            </Typography.Text>
            <Typography.Text strong>
              {t('总消耗额度')}: {summary.consumedQuota}
            </Typography.Text>
            <Typography.Text strong>
              {t('总预估费用')}(USD): {formatUSD(summary.estimatedCost)}
            </Typography.Text>
          </Space>

          <Table
            loading={loading}
            columns={columns}
            dataSource={rows}
            rowKey={(record) => `${record.user_id}-${record.model_name}`}
            pagination={{
              currentPage: page,
              pageSize,
              total,
              showSizeChanger: true,
              pageSizeOpts: [20, 50, 100],
              onPageChange: (currentPage) => {
                setPage(currentPage);
                fetchData({
                  targetPage: currentPage,
                  targetPageSize: pageSize,
                  targetKeyword: keyword,
                  targetDateRange: dateRange,
                });
              },
              onPageSizeChange: (size) => {
                setPageSize(size);
                setPage(1);
                fetchData({
                  targetPage: 1,
                  targetPageSize: size,
                  targetKeyword: keyword,
                  targetDateRange: dateRange,
                });
              },
            }}
          />
        </Space>
      </Card>
    </div>
  );
}
