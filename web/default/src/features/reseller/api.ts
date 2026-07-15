import { api } from '@/lib/api'

export async function getResellerProfile() {
  const res = await api.get('/api/reseller/profile')
  return res.data
}

export async function updateResellerProfile(payload: {
  host: string
  logo: string
  site_name: string
  name: string
  markup_rate: number
}) {
  const res = await api.put('/api/reseller/profile', payload)
  return res.data
}

export async function getResellerProfit() {
  const res = await api.get('/api/reseller/profit')
  return res.data
}

export async function getResellerProfitRecords(params: {
  p?: number
  page_size?: number
  user_id?: number
  start_at?: number
  end_at?: number
}) {
  const res = await api.get('/api/reseller/profit/records', { params })
  return res.data
}

export async function getResellerUsers(params: { p?: number; page_size?: number }) {
  const res = await api.get('/api/reseller/users', { params })
  return res.data
}

export async function getResellerWithdrawals(params: { p?: number; page_size?: number }) {
  const res = await api.get('/api/reseller/withdrawals', { params })
  return res.data
}

export async function createResellerWithdrawal(payload: {
  amount: number
  account: string
  remark?: string
}) {
  const res = await api.post('/api/reseller/withdrawals', payload)
  return res.data
}

export async function getAdminResellerWithdrawals(params: { p?: number; page_size?: number }) {
  const res = await api.get('/api/admin/reseller/withdrawals', { params })
  return res.data
}

export async function approveResellerWithdrawal(id: number) {
  const res = await api.post(`/api/admin/reseller/withdrawals/${id}/approve`)
  return res.data
}

export async function rejectResellerWithdrawal(id: number, remark = '') {
  const res = await api.post(`/api/admin/reseller/withdrawals/${id}/reject`, null, {
    params: { remark },
  })
  return res.data
}
