/** 物理常量与基础车辆参数（SI 单位） */

export const G = 9.81; // m/s²
export const AIR_DENSITY = 1.225; // kg/m³

export interface VehicleSpec {
  mass: number; // kg（含车手）
  wheelbase: number; // m
  cgHeight: number; // m 质心高度
  frontalArea: number; // m²
  dragCoefficient: number;
  downforceCoefficient: number; // Cl·A 合并系数
  enginePower: number; // W
  tireMu: number; // 干燥沥青基准摩擦系数
}

/** ApexLab 教学用参考赛车（近似 F4 级别） */
export const REFERENCE_CAR: VehicleSpec = {
  mass: 570,
  wheelbase: 2.6,
  cgHeight: 0.32,
  frontalArea: 1.3,
  dragCoefficient: 0.9,
  downforceCoefficient: 1.8,
  enginePower: 118_000,
  tireMu: 1.35,
};