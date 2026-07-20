'use client';

import dayjs, { type Dayjs } from 'dayjs';
import 'dayjs/locale/zh-cn';
import { ConfigProvider, DatePicker, theme } from 'antd';
import type { DatePickerProps, ThemeConfig } from 'antd';
import zhCN from 'antd/locale/zh_CN';

dayjs.locale('zh-cn');

export const APP_DATE_FORMAT = 'YYYY-MM-DD';
export const APP_TIME_FORMAT = 'HH:mm:ss';
export const APP_DATE_TIME_FORMAT = `${APP_DATE_FORMAT} ${APP_TIME_FORMAT}`;

type AntdDatePickerProps = DatePickerProps<Dayjs, false>;

type AppDateTimePickerProps = Omit<
  AntdDatePickerProps,
  'format' | 'showTime' | 'style'
> & {
  style?: AntdDatePickerProps['style'];
};

const appDatePickerTheme: ThemeConfig = {
  algorithm: theme.darkAlgorithm,
  token: {
    colorPrimary: '#1677ff',
    colorBgBase: '#050505',
    colorBgContainer: '#101010',
    colorBgElevated: '#1b1b1b',
    colorBorder: 'rgba(255,255,255,0.10)',
    colorText: 'rgba(255,255,255,0.88)',
    colorTextSecondary: 'rgba(255,255,255,0.62)',
    colorTextTertiary: 'rgba(255,255,255,0.42)',
    borderRadius: 6,
    fontFamily: 'var(--font-sans)',
  },
};

const withPickerStyle = (style?: AntdDatePickerProps['style']) => ({
  width: '100%',
  ...style,
});

export const parseAppDateTime = (value?: string | null) => {
  if (!value) return null;
  const parsed = dayjs(value.replace('T', ' '));
  return parsed.isValid() ? parsed : null;
};

export const formatAppDateTime = (value: Dayjs | null) => (
  value?.isValid() ? value.format(APP_DATE_TIME_FORMAT) : ''
);

export function AppDateTimePicker({
  allowClear = false,
  inputReadOnly = true,
  style,
  ...props
}: AppDateTimePickerProps) {
  return (
    <ConfigProvider locale={zhCN} theme={appDatePickerTheme}>
      <DatePicker
        {...props}
        allowClear={allowClear}
        inputReadOnly={inputReadOnly}
        format={APP_DATE_TIME_FORMAT}
        showTime={{ format: APP_TIME_FORMAT }}
        style={withPickerStyle(style)}
      />
    </ConfigProvider>
  );
}

export function AppDatePicker({
  allowClear = false,
  inputReadOnly = true,
  style,
  ...props
}: AntdDatePickerProps) {
  return (
    <ConfigProvider locale={zhCN} theme={appDatePickerTheme}>
      <DatePicker
        {...props}
        allowClear={allowClear}
        inputReadOnly={inputReadOnly}
        format={APP_DATE_FORMAT}
        style={withPickerStyle(style)}
      />
    </ConfigProvider>
  );
}
