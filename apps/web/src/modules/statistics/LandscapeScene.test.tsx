import { cleanup, render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Mesh, type PerspectiveCamera, type Scene } from 'three';
import { LandscapeScene } from './LandscapeScene';
import { evolutionSeries } from './aggregation';
import { areas } from '../evolution/scoring';
import type { SceneProps } from './sceneTypes';

const renderer = vi.hoisted(() => ({
  render: vi.fn(),
  dispose: vi.fn(),
  forceContextLoss: vi.fn(),
}));
vi.mock('three', async (importOriginal) => {
  const three = await importOriginal<typeof import('three')>();
  return {
    ...three,
    WebGLRenderer: class {
      domElement = document.createElement('canvas');
      setPixelRatio() {}
      setSize() {}
      render = renderer.render;
      dispose = renderer.dispose;
      forceContextLoss = renderer.forceContextLoss;
    },
  };
});
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      disconnect() {}
    },
  );
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(600);
  vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(360);
  for (const token of [
    'finances',
    'workouts',
    'rest',
    'knowledge',
    'foreground',
    'muted',
  ])
    document.documentElement.style.setProperty(
      `--color-${token}`,
      'rgb(128, 128, 128)',
    );
  renderer.render.mockImplementation(
    (scene: Scene, camera: PerspectiveCamera) => {
      scene.updateMatrixWorld();
      camera.updateMatrixWorld();
    },
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  document.documentElement.removeAttribute('style');
});
function props(): SceneProps {
  return {
    series: evolutionSeries(
      [{ id: 'w', area: 'Treinos', daysAgo: 0, effort: 1 }],
      '2026-11-13',
      7,
    ),
    visible: [...areas],
    mode: 'landscape',
    selected: 6,
    cameraCommand: { action: 'reset', version: 0 },
    onSelect: vi.fn(),
    onUnavailable: vi.fn(),
  };
}
function renderedScene() {
  const call = renderer.render.mock.calls.at(-1)!;
  return { scene: call[0] as Scene, camera: call[1] as PerspectiveCamera };
}
describe('Ciclo de vida da cena (renderer isolado, sem GPU)', () => {
  it('renderiza sob demanda e libera recursos ao desmontar', async () => {
    const view = render(<LandscapeScene {...props()} />);
    await waitFor(() => expect(renderer.render).toHaveBeenCalled());
    const calls = renderer.render.mock.calls.length;
    await new Promise((resolve) => setTimeout(resolve, 40));
    expect(renderer.render).toHaveBeenCalledTimes(calls);
    view.unmount();
    expect(renderer.dispose).toHaveBeenCalledOnce();
    expect(renderer.forceContextLoss).toHaveBeenCalledOnce();
  });
  it('preserva câmera entre modos, alterna geometrias com os mesmos valores e restaura posição', async () => {
    const initial = props();
    const view = render(<LandscapeScene {...initial} />);
    await waitFor(() => expect(renderer.render).toHaveBeenCalled());
    const original = renderedScene().camera.position.clone();
    view.rerender(
      <LandscapeScene
        {...initial}
        cameraCommand={{ action: 'left', version: 1 }}
      />,
    );
    await waitFor(() =>
      expect(renderedScene().camera.position.equals(original)).toBe(false),
    );
    const moved = renderedScene().camera.position.clone();
    view.rerender(
      <LandscapeScene
        {...initial}
        cameraCommand={{ action: 'left', version: 1 }}
        mode="bars"
      />,
    );
    await waitFor(() =>
      expect(renderedScene().camera.position.equals(moved)).toBe(true),
    );
    const meshes: Mesh[] = [];
    renderedScene().scene.traverse((object) => {
      if (object instanceof Mesh) meshes.push(object);
    });
    expect(
      meshes.filter((mesh) => mesh.geometry.type === 'BoxGeometry'),
    ).toHaveLength(1);
    expect(
      meshes.find((mesh) => mesh.geometry.type === 'BoxGeometry')?.userData
        .area,
    ).toBe('Treinos');
    view.rerender(
      <LandscapeScene
        {...initial}
        cameraCommand={{ action: 'reset', version: 2 }}
      />,
    );
    await waitFor(() =>
      expect(renderedScene().camera.position.distanceTo(original)).toBeLessThan(
        0.0001,
      ),
    );
  });
  it('usa raycasting real para selecionar um ponto e detecta perda de contexto', async () => {
    const initial = props();
    const view = render(<LandscapeScene {...initial} mode="bars" />);
    await waitFor(() => expect(renderer.render).toHaveBeenCalled());
    const { scene, camera } = renderedScene();
    let bar: Mesh | undefined;
    scene.traverse((object) => {
      if (object instanceof Mesh && object.geometry.type === 'BoxGeometry')
        bar = object;
    });
    expect(bar).toBeDefined();
    const target = bar!.position.clone().project(camera);
    const canvas = view.container.querySelector('canvas')!;
    vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue({
      left: 0,
      top: 0,
      width: 600,
      height: 360,
      right: 600,
      bottom: 360,
      x: 0,
      y: 0,
      toJSON() {},
    });
    function pointer(type: string) {
      const event = new MouseEvent(type, {
        bubbles: true,
        clientX: (target.x + 1) * 300,
        clientY: (1 - target.y) * 180,
      });
      Object.defineProperty(event, 'pointerId', { value: 1 });
      Object.defineProperty(event, 'pointerType', { value: 'mouse' });
      return event;
    }
    canvas.setPointerCapture = vi.fn();
    canvas.releasePointerCapture = vi.fn();
    canvas.dispatchEvent(pointer('pointerdown'));
    canvas.dispatchEvent(pointer('pointerup'));
    expect(initial.onSelect).toHaveBeenCalledWith(6, 'Treinos');
    canvas.dispatchEvent(new Event('webglcontextlost', { cancelable: true }));
    expect(initial.onUnavailable).toHaveBeenCalledOnce();
  });
});
