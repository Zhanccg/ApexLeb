/**
 * 基础车辆动力学纯函数。
 * 第一阶段提供解析近似（可用于报告与教学校验），
 * 第二阶段将在此基础上实现逐帧数值仿真器。
 */
import { AIR_DENSITY, G, type VehicleSpec } from './constants';

export const kmhToMs = (kmh: number): number => kmh / 3.6;
export const msToKmh = (ms: number): number => ms * 3.6;

/** 空气阻力 F = ½ρCdA·v² */
export function dragForce(car: VehicleSpec, speedMs: number): number {
  return 0.5 * AIR_DENSITY * car.dragCoefficient * car.frontalArea * speedMs ** 2;
}

/** 气动下压力 F = ½ρClA·v² */
export function downforce(car: VehicleSpec, speedMs: number): number {
  return 0.5 * AIR_DENSITY * car.downforceCoefficient * speedMs ** 2;
}

/**
 * 理想制动距离（不含反应时间）：d = v² / (2μg)。
 * mu 为路面-轮胎摩擦系数，忽略气动下压力时为教学基准模型。
 */
export function brakingDistance(speedMs: number, mu: number): number {
  if (mu <= 0) return Infinity;
  return speedMs ** 2 / (2 * mu * G);
}

/** 考虑下压力的有效摩擦系数（高速时抓地增强） */
export function effectiveMu(car: VehicleSpec, speedMs: number, surfaceMu: number): number {
  const normal = car.mass * G + downforce(car, speedMs);
  return (surfaceMu * normal) / (car.mass * G);
}

/** 半径 r 弯道的理论极限过弯速度 v = √(μgr) */
export function corneringLimitSpeed(radiusM: number, mu: number): number {
  return Math.sqrt(Math.max(0, mu * G * radiusM));
}

/** 向心（侧向）加速度 a = v²/r，单位 m/s² */
export function lateralAccel(speedMs: number, radiusM: number): number {
  if (radiusM <= 0) return 0;
  return speedMs ** 2 / radiusM;
}

/** 向心加速度 a = v²/r（以 g 为单位） */
export function lateralG(speedMs: number, radiusM: number): number {
  return lateralAccel(speedMs, radiusM) / G;
}