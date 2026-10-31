import type { ChartData } from '../../types/infra';
import { historyToCharts } from '../../utils/systemTransform';
import { mockSystemInfo, mockSystemMetrics } from './resources.mock';

export type { ChartData };

export const mockCharts: ChartData[] = historyToCharts(mockSystemMetrics, mockSystemInfo);
