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
import { Navigate, useLocation } from 'react-router-dom';
import { history } from './history';

export function authHeader() {
  // return authorization header with jwt token
  let user = JSON.parse(localStorage.getItem('user'));

  if (user && user.token) {
    return { Authorization: 'Bearer ' + user.token };
  } else {
    return {};
  }
}

export const AuthRedirect = ({ children }) => {
  const user = localStorage.getItem('user');

  if (user) {
    return <Navigate to='/console' replace />;
  }

  return children;
};

function PrivateRoute({ children }) {
  const location = useLocation();
  if (!localStorage.getItem('user')) {
    return <Navigate to='/login' state={{ from: history.location }} />;
  }
  const statusRaw = localStorage.getItem('status');
  const userRaw = localStorage.getItem('user');
  if (statusRaw && userRaw) {
    try {
      const status = JSON.parse(statusRaw);
      const user = JSON.parse(userRaw);
      const realNameRequired = status?.realname_verification === true;
      const realNamePassed =
        user?.real_name_verified === true || user?.real_name_status === 'passed';
      const bypassPath = location.pathname === '/realname-required';
      if (
        realNameRequired &&
        !bypassPath &&
        Number(user?.role || 0) < 10 &&
        !realNamePassed
      ) {
        return (
          <Navigate
            to='/realname-required'
            state={{ from: location }}
            replace
          />
        );
      }
    } catch (e) {
      // ignore
    }
  }
  return children;
}

export function AdminRoute({ children }) {
  const location = useLocation();
  const raw = localStorage.getItem('user');
  if (!raw) {
    return <Navigate to='/login' state={{ from: history.location }} />;
  }
  try {
    const user = JSON.parse(raw);
    const statusRaw = localStorage.getItem('status');
    if (statusRaw) {
      const status = JSON.parse(statusRaw);
      const realNamePassed =
        user?.real_name_verified === true || user?.real_name_status === 'passed';
      if (
        status?.realname_verification === true &&
        Number(user?.role || 0) < 10 &&
        !realNamePassed &&
        location.pathname !== '/realname-required'
      ) {
        return (
          <Navigate
            to='/realname-required'
            state={{ from: location }}
            replace
          />
        );
      }
    }
    if (user && typeof user.role === 'number' && user.role >= 10) {
      return children;
    }
  } catch (e) {
    // ignore
  }
  return <Navigate to='/forbidden' replace />;
}

export { PrivateRoute };
