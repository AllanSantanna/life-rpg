import { useEffect, useRef } from 'react';
import {
  AmbientLight,
  BoxGeometry,
  BufferGeometry,
  Color,
  DirectionalLight,
  DoubleSide,
  EdgesGeometry,
  GridHelper,
  Group,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshStandardMaterial,
  PerspectiveCamera,
  Raycaster,
  Scene,
  SphereGeometry,
  Spherical,
  Vector2,
  Vector3,
  WebGLRenderer,
} from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { areas } from '../evolution/scoring';
import { displayDate } from '../records/dates';
import { surfaceGeometry, timePosition } from './sceneGeometry';
import type { SceneProps } from './sceneTypes';
import type { Pillar } from './types';

function disposeGroup(group: Group) {
  group.traverse((object) => {
    if (object instanceof Mesh || object instanceof LineSegments) {
      object.geometry.dispose();
      for (const material of Array.isArray(object.material)
        ? object.material
        : [object.material])
        material.dispose();
    }
  });
  group.clear();
}

export function LandscapeScene({
  series,
  visible,
  mode,
  selected,
  cameraCommand,
  onSelect,
  onUnavailable,
}: SceneProps) {
  const mount = useRef<HTMLDivElement>(null);
  const runtime = useRef<{
    scene: Scene;
    camera: PerspectiveCamera;
    controls: OrbitControls;
    group: Group;
    render: () => void;
    labels: { element: HTMLSpanElement; point: Vector3 }[];
    colors: Record<Pillar, Color>;
  } | null>(null);
  const pick = useRef(onSelect);
  useEffect(() => {
    pick.current = onSelect;
  }, [onSelect]);

  useEffect(() => {
    const element = mount.current;
    if (!element) return;
    let renderer: WebGLRenderer;
    try {
      renderer = new WebGLRenderer({
        antialias: true,
        alpha: true,
        powerPreference: 'low-power',
      });
    } catch {
      onUnavailable();
      return;
    }
    const style = getComputedStyle(element);
    const color = (token: string) =>
      new Color(style.getPropertyValue(token).trim());
    const colors = {
      Finanças: color('--color-finances'),
      Treinos: color('--color-workouts'),
      Descanso: color('--color-rest'),
      Conhecimento: color('--color-knowledge'),
    };
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.domElement.setAttribute('aria-hidden', 'true');
    element.append(renderer.domElement);
    const scene = new Scene();
    const camera = new PerspectiveCamera(43, 1, 0.1, 100);
    camera.position.set(11, 10, 13);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 2, 0);
    controls.minDistance = 9;
    controls.maxDistance = 30;
    controls.maxPolarAngle = Math.PI * 0.48;
    controls.minPolarAngle = 0.15;
    controls.enablePan = false;
    // Sem inércia ou rotação automática: não há animação contínua, inclusive em reduced-motion.
    controls.enableDamping = false;
    controls.update();
    controls.saveState();
    const group = new Group();
    const grid = new GridHelper(
      12,
      12,
      color('--color-muted'),
      color('--color-muted'),
    );
    grid.material.transparent = true;
    grid.material.opacity = 0.15;
    grid.position.y = -0.04;
    scene.add(group, grid, new AmbientLight(color('--color-foreground'), 1.5));
    const light = new DirectionalLight(color('--color-foreground'), 2);
    light.position.set(2, 10, 5);
    scene.add(light);
    const labelLayer = document.createElement('div');
    labelLayer.className = 'statistics-scene-labels';
    labelLayer.setAttribute('aria-hidden', 'true');
    element.append(labelLayer);
    const labels: { element: HTMLSpanElement; point: Vector3 }[] = [];
    const addLabel = (text: string, point: Vector3) => {
      const span = document.createElement('span');
      span.textContent = text;
      labelLayer.append(span);
      labels.push({ element: span, point });
    };
    for (const value of [0, 50, 100])
      addLabel(String(value), new Vector3(-5.6, value * 0.06, -4.1));
    addLabel('Pilares', new Vector3(-5.6, 0, 0));
    const axes = new LineSegments(
      new BufferGeometry().setFromPoints([
        new Vector3(-5.6, 0, -4.1),
        new Vector3(-5.6, 6, -4.1),
        new Vector3(-5.6, 3, -4.1),
        new Vector3(5.5, 3, -4.1),
        new Vector3(-5.6, 6, -4.1),
        new Vector3(5.5, 6, -4.1),
      ]),
      new LineBasicMaterial({
        color: color('--color-muted'),
        transparent: true,
        opacity: 0.18,
      }),
    );
    scene.add(axes);
    let frame = 0;
    let disposed = false;
    function draw() {
      frame = 0;
      if (disposed) return;
      renderer.render(scene, camera);
      for (const label of labels) {
        const projected = label.point.clone().project(camera);
        const halfWidth = label.element.offsetWidth / 2 + 4;
        const halfHeight = label.element.offsetHeight / 2 + 4;
        label.element.style.left = `${Math.max(halfWidth, Math.min(element!.clientWidth - halfWidth, ((projected.x + 1) * element!.clientWidth) / 2))}px`;
        label.element.style.top = `${Math.max(halfHeight, Math.min(element!.clientHeight - halfHeight, ((1 - projected.y) * element!.clientHeight) / 2))}px`;
        label.element.hidden =
          projected.z > 1 ||
          Math.abs(projected.x) > 1 ||
          Math.abs(projected.y) > 1;
      }
    }
    function render() {
      if (!frame && !disposed) frame = requestAnimationFrame(draw);
    }
    function resize() {
      const width = element!.clientWidth;
      const height = element!.clientHeight;
      if (!width || !height) return;
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      render();
    }
    const observer = new ResizeObserver(resize);
    observer.observe(element);
    controls.addEventListener('change', render);
    const raycaster = new Raycaster();
    let down: { x: number; y: number; id: number } | null = null;
    function start(event: PointerEvent) {
      down = down
        ? null
        : { x: event.clientX, y: event.clientY, id: event.pointerId };
    }
    function end(event: PointerEvent) {
      const previous = down;
      down = null;
      if (
        !previous ||
        previous.id !== event.pointerId ||
        Math.hypot(event.clientX - previous.x, event.clientY - previous.y) > 5
      )
        return;
      const rect = renderer.domElement.getBoundingClientRect();
      raycaster.setFromCamera(
        new Vector2(
          ((event.clientX - rect.left) / rect.width) * 2 - 1,
          (-(event.clientY - rect.top) / rect.height) * 2 + 1,
        ),
        camera,
      );
      const hit = raycaster
        .intersectObjects(group.children)
        .find(
          (item) =>
            item.object instanceof Mesh &&
            typeof item.object.userData.area === 'string',
        );
      if (!hit) return;
      const area = areas.find((item) => item === hit.object.userData.area);
      const length = Number(hit.object.userData.length);
      const index =
        typeof hit.object.userData.index === 'number'
          ? hit.object.userData.index
          : Math.round(((hit.point.x + 5) / 10) * (length - 1));
      if (area && Number.isFinite(index))
        pick.current(Math.max(0, Math.min(length - 1, index)), area);
    }
    function lost(event: Event) {
      event.preventDefault();
      onUnavailable();
    }
    renderer.domElement.addEventListener('pointerdown', start);
    renderer.domElement.addEventListener('pointerup', end);
    renderer.domElement.addEventListener('webglcontextlost', lost);
    runtime.current = {
      scene,
      camera,
      controls,
      group,
      render,
      labels,
      colors,
    };
    resize();
    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      observer.disconnect();
      controls.removeEventListener('change', render);
      controls.dispose();
      renderer.domElement.removeEventListener('pointerdown', start);
      renderer.domElement.removeEventListener('pointerup', end);
      renderer.domElement.removeEventListener('webglcontextlost', lost);
      disposeGroup(group);
      grid.geometry.dispose();
      grid.material.dispose();
      axes.geometry.dispose();
      axes.material.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
      labelLayer.remove();
      runtime.current = null;
    };
  }, [onUnavailable]);

  useEffect(() => {
    const current = runtime.current;
    if (!current) return;
    const { group, colors, labels } = current;
    disposeGroup(group);
    // Remove somente os rótulos de datas; os rótulos dos eixos permanecem.
    for (const label of labels.splice(4)) label.element.remove();
    for (const index of [
      0,
      Math.floor((series.length - 1) / 2),
      series.length - 1,
    ]) {
      const span = document.createElement('span');
      span.textContent = displayDate(series[index]!.date).slice(0, 5);
      mount.current?.querySelector('.statistics-scene-labels')?.append(span);
      labels.push({
        element: span,
        point: new Vector3(timePosition(index, series.length), -0.15, 4.3),
      });
    }
    for (const area of visible) {
      const lane = (areas.indexOf(area) - 1.5) * 2;
      const material = () =>
        new MeshStandardMaterial({
          color: colors[area],
          side: DoubleSide,
          transparent: true,
          opacity: mode === 'surface' ? 0.5 : 0.78,
          roughness: 0.6,
          metalness: 0.18,
          depthWrite: mode === 'bars',
        });
      if (mode === 'bars') {
        series.forEach((point, index) => {
          if (!point.scores[area]) return;
          const height = point.scores[area] * 0.06;
          const mesh = new Mesh(
            new BoxGeometry(Math.min(0.55, 8 / series.length), height, 0.9),
            material(),
          );
          mesh.position.set(
            timePosition(index, series.length),
            height / 2,
            lane,
          );
          mesh.userData = { area, index, length: series.length };
          group.add(mesh);
        });
      } else {
        const geometry = surfaceGeometry(series, area, lane, mode);
        const mesh = new Mesh(geometry, material());
        mesh.userData = { area, length: series.length };
        const wire = new LineSegments(
          new EdgesGeometry(geometry, mode === 'surface' ? 0 : 10),
          new LineBasicMaterial({
            color: colors[area],
            transparent: true,
            opacity: 0.65,
          }),
        );
        group.add(mesh, wire);
      }
      const point = series[selected];
      if (point) {
        const marker = new Mesh(
          new SphereGeometry(0.11, 12, 8),
          new MeshStandardMaterial({
            color: colors[area],
            emissive: colors[area],
            emissiveIntensity: 0.5,
          }),
        );
        marker.position.set(
          timePosition(selected, series.length),
          point.scores[area] * 0.06,
          lane,
        );
        marker.userData = { area, index: selected, length: series.length };
        group.add(marker);
      }
    }
    current.render();
  }, [series, visible, mode, selected]);

  useEffect(() => {
    const current = runtime.current;
    if (!current) return;
    const { camera, controls } = current;
    if (cameraCommand.action === 'reset') controls.reset();
    else {
      const offset = camera.position.clone().sub(controls.target);
      const spherical = new Spherical().setFromVector3(offset);
      switch (cameraCommand.action) {
        case 'left':
          spherical.theta -= 0.22;
          break;
        case 'right':
          spherical.theta += 0.22;
          break;
        case 'up':
          spherical.phi -= 0.16;
          break;
        case 'down':
          spherical.phi += 0.16;
          break;
        case 'in':
          spherical.radius *= 0.85;
          break;
        case 'out':
          spherical.radius /= 0.85;
          break;
      }
      spherical.phi = Math.max(
        controls.minPolarAngle,
        Math.min(controls.maxPolarAngle, spherical.phi),
      );
      spherical.radius = Math.max(
        controls.minDistance,
        Math.min(controls.maxDistance, spherical.radius),
      );
      camera.position.copy(
        new Vector3().setFromSpherical(spherical).add(controls.target),
      );
      controls.update();
    }
    current.render();
  }, [cameraCommand.action, cameraCommand.version]);
  return (
    <div
      className="statistics-scene"
      ref={mount}
      role="img"
      aria-label="Paisagem tridimensional dos quatro pilares; valores disponíveis abaixo"
    />
  );
}
