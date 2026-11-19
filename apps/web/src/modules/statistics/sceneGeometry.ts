import { BufferGeometry, Float32BufferAttribute } from 'three';
import type { EvolutionPoint, LandscapeMode, Pillar } from './types';

export function timePosition(index: number, length: number) {
  return -5 + (10 * index) / Math.max(1, length - 1);
}

/** A crista representa o valor observado; as laterais são apenas a largura da faixa. */
export function surfaceGeometry(
  series: EvolutionPoint[],
  area: Pillar,
  lane: number,
  mode: LandscapeMode,
) {
  const vertices: number[] = [];
  const indices: number[] = [];
  for (const [index, point] of series.entries()) {
    for (const side of [-1, 0, 1]) {
      const height =
        mode === 'landscape' && side !== 0 ? 0 : point.scores[area] * 0.06;
      vertices.push(
        timePosition(index, series.length),
        height,
        lane + side * 0.65,
      );
    }
    if (index > 0) {
      for (let side = 0; side < 2; side++) {
        const a = (index - 1) * 3 + side;
        const b = index * 3 + side;
        indices.push(a, b, a + 1, a + 1, b, b + 1);
      }
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(vertices, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}
