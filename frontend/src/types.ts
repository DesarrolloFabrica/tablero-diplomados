export type Linea = 'Diplomado' | 'Especializacion'

export interface PeriodoInfo {
  linea: Linea
  periodo: string
  primer_corte: string
  ultimo_corte: string
  cortes: number
}

export interface Filtros {
  periodos: PeriodoInfo[]
  lineas: Linea[]
}

export interface Kpis {
  ordenes: number
  estudiantes: number
  pagadas: number
  no_pagadas: number
  nuevos: number
  vendido: number
  becas: number
  ingreso_neto: number
  por_convertir: number
}

export interface PuntoEvolucion {
  linea: Linea
  periodo: string
  fecha_corte: string
  ordenes: number
  pagadas: number
  vendido: number
  ingreso_neto: number
  nuevas: number
  pasan_a_pago: number
}

export interface Programa {
  linea: Linea
  cod_unidad: string
  nombre: string
  ordenes: number
  pagadas: number
  vendido: number
  por_convertir: number
}

export interface Asesor {
  asesor: string
  ordenes: number
  pagadas: number
  vendido: number
}

export interface Tablero {
  filtros: { linea: Linea | null; periodo: string | null }
  alcance: { linea: Linea; periodo: string; ultimo_corte: string; corte_anterior: string | null }[]
  kpis: Kpis
  kpis_anterior: Kpis | null
  evolucion: PuntoEvolucion[]
  programas: Programa[]
  asesores: Asesor[]
  genero: { genero: 'F' | 'M' | 'Otro'; estudiantes: number }[]
  edad: { rango: string; F: number; M: number }[]
  regiones: { region: string; estudiantes: number }[]
  generado: string
}
