# Sistema de Inventario S&P — frontend

Aplicación web para llevar el **inventario permanente valorizado** de una empresa comercializadora de chatarra metálica: registro de compras, ventas, exportaciones, mermas y ajustes; consulta del kardex por promedio ponderado; cierre de periodos; **Registro del Inventario Permanente en Unidades Físicas (Formato 12.1 SUNAT)** listo para hojas legalizadas; reportes; y exportación del asiento contable.

Trabajo de Aplicación Profesional (TAP) de **Enrique Valdez Alva** y **Lenyn Mitchel Rodriguez Benites**.

> Este repositorio contiene **solo el frontend** y no incluye datos reales. La API, la lógica de costos y los datos son privados.

**Tecnologías:** React 19 · Vite 8 · TypeScript 5.9 · Tailwind CSS 4 · shadcn/ui · React Router 8 · TanStack Query y Table · react-hook-form + zod · Vitest · Playwright · pnpm 12 · Vercel.

## Desarrollo
```powershell
pnpm install
Copy-Item .env.example .env
pnpm run dev            # http://localhost:5173 (requiere la API local en http://localhost:3000)
pnpm run lint; pnpm test; pnpm run build
```

Documentación: [`docs/UI-UX.md`](./docs/UI-UX.md) (diseño y pantallas) · [`docs/CONTRATO-API.md`](./docs/CONTRATO-API.md) · [`docs/AVANCE.md`](./docs/AVANCE.md).

## Licencia
Software propietario. **Todos los derechos reservados.** Que el repositorio sea público no concede ninguna licencia de uso (ver [`LICENSE`](./LICENSE)).
