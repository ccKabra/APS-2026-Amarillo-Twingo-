


import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, Pressable, RefreshControl, SectionList, Switch, Text, View } from 'react-native';
import { api } from '../api';
import { colores, formatearFecha, formatearHora, nombreDeRolPiloto } from '../tema';
import { Aviso, Chips, Insignia, estilos } from '../componentes';

const INTERVALO_MS = 5_000;

function agrupar(pilotos) {
  const grupos = new Map();
  for (const p of pilotos) {
    if (!grupos.has(p.escuderia.id)) {
      grupos.set(p.escuderia.id, { title: p.escuderia.nombreOficial, categoria: p.categoria.nombre, data: [] });
    }
    grupos.get(p.escuderia.id).data.push(p);
  }
  return [...grupos.values()];
}

function useActualizacionPeriodica(cargar) {
  const ref = useRef(cargar);
  ref.current = cargar;
  useEffect(() => {
    let estadoApp = AppState.currentState;
    const id = setInterval(() => {
      if (estadoApp === 'active') ref.current({ silencioso: true });
    }, INTERVALO_MS);
    const suscripcion = AppState.addEventListener('change', (estado) => {
      estadoApp = estado;
    });
    return () => {
      clearInterval(id);
      suscripcion.remove();
    };
  }, []);
}


export default function PantallaNomina({ modo, usuario, alVolver }) {
  const [categorias, setCategorias] = useState([]);
  const [categoria, setCategoria] = useState('');
  const [incluirBajas, setIncluirBajas] = useState(false);
  const escuderiasActivas = useMemo(() => (usuario?.escuderias ?? []).filter((e) => e.activa), [usuario]);
  const [escuderiaId, setEscuderiaId] = useState(escuderiasActivas[0]?.id ?? null);
  const [pilotos, setPilotos] = useState(null);
  const [error, setError] = useState(null);
  const [actualizado, setActualizado] = useState(null);
  const [refrescando, setRefrescando] = useState(false);

  useEffect(() => {
    if (modo === 'escuderia') return;
    api('GET', '/publico/categorias', undefined, { sinSesion: true })
      .then((r) => setCategorias(r.categorias))
      .catch(() => {});
  }, [modo]);

  const cargar = useCallback(
    async ({ silencioso } = {}) => {
      if (!silencioso) setRefrescando(true);
      try {
        let respuesta;
        if (modo === 'publico') {
          respuesta = await api('GET', `/publico/pilotos${categoria ? `?categoria=${categoria}` : ''}`, undefined, {
            sinSesion: true,
          });
        } else if (modo === 'fia') {
          const filtros = [categoria && `categoria=${categoria}`, incluirBajas && 'incluirBajas=true'].filter(Boolean).join('&');
          respuesta = await api('GET', `/fia/pilotos${filtros ? `?${filtros}` : ''}`);
        } else if (escuderiaId) {
          respuesta = await api('GET', `/escuderia/${escuderiaId}/pilotos`);
        } else {
          respuesta = { pilotos: [] };
        }
        setPilotos(respuesta.pilotos);
        setActualizado(formatearHora());
        setError(null);
      } catch (e) {
        if (e.status !== 401) setError(e.message);
      } finally {
        setRefrescando(false);
      }
    },
    [modo, categoria, incluirBajas, escuderiaId],
  );

  useEffect(() => {
    setPilotos(null);
    cargar();
  }, [cargar]);
  useActualizacionPeriodica(cargar);

  const secciones = useMemo(() => agrupar(pilotos ?? []), [pilotos]);
  const titulo = modo === 'fia' ? 'Nómina general' : modo === 'escuderia' ? 'Mi nómina' : 'Nómina de pilotos';

  const cabecera = (
    <View style={{ marginBottom: 6 }}>
      {alVolver && (
        <Pressable onPress={alVolver} style={{ marginBottom: 8 }} hitSlop={8}>
          <Text style={{ color: colores.info }}>← Volver al inicio de sesión</Text>
        </Pressable>
      )}
      <Text style={estilos.titulo}>{titulo}</Text>
      <Text style={estilos.subtitulo}>
        {modo === 'fia'
          ? 'Todas las escuderías, con fecha de nacimiento e historial de bajas.'
          : modo === 'escuderia'
            ? 'La carga y edición de pilotos se hace desde la web en este sprint.'
            : 'Titulares y suplentes de cada escudería.'}
      </Text>
      {modo === 'escuderia' ? (
        escuderiasActivas.length > 1 ? (
          <Chips
            opciones={escuderiasActivas.map((e) => ({ valor: e.id, texto: `${e.nombreOficial} (${e.categoria})` }))}
            valor={escuderiaId}
            alCambiar={setEscuderiaId}
          />
        ) : (
          <Text style={{ fontWeight: '700', fontSize: 16, color: colores.tinta }}>
            {escuderiasActivas[0]?.nombreOficial ?? 'Sin escuderías activas'}
          </Text>
        )
      ) : (
        <Chips
          opciones={[{ valor: '', texto: 'Todas' }, ...categorias.map((c) => ({ valor: c.codigo, texto: c.nombre }))]}
          valor={categoria}
          alCambiar={setCategoria}
        />
      )}
      {modo === 'fia' && (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 }}>
          <Switch value={incluirBajas} onValueChange={setIncluirBajas} />
          <Text>Incluir pilotos dados de baja</Text>
        </View>
      )}
      <Text style={{ color: colores.ok, fontSize: 12, marginTop: 8 }}>
        ● Se actualiza sola cada 5 s{actualizado ? ` · última: ${actualizado}` : ''}
      </Text>
      {error && (
        <View style={{ marginTop: 8 }}>
          <Aviso tono="error">{error}</Aviso>
        </View>
      )}
    </View>
  );

  return (
    <SectionList
      style={estilos.pantalla}
      contentContainerStyle={estilos.contenido}
      sections={secciones}
      keyExtractor={(p) => String(p.id)}
      ListHeaderComponent={cabecera}
      ListEmptyComponent={
        pilotos === null ? (
          <Text style={{ color: colores.suave }}>Cargando…</Text>
        ) : (
          <Text style={{ color: colores.suave }}>No hay pilotos para mostrar.</Text>
        )
      }
      refreshControl={<RefreshControl refreshing={refrescando} onRefresh={() => cargar()} />}
      stickySectionHeadersEnabled={false}
      renderSectionHeader={({ section }) => (
        <View
          style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 14, marginBottom: 8 }}
        >
          <Text style={{ fontSize: 17, fontWeight: '700', color: colores.tinta, flexShrink: 1 }}>{section.title}</Text>
          <Insignia tono="info">{section.categoria}</Insignia>
        </View>
      )}
      renderItem={({ item: p }) => (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
            backgroundColor: colores.superficie,
            borderWidth: 1,
            borderColor: colores.borde,
            borderLeftWidth: 4,
            borderLeftColor: p.rol === 'TITULAR' ? colores.ok : colores.bordeFuerte,
            borderRadius: 10,
            padding: 12,
            marginBottom: 8,
            opacity: p.activo === false ? 0.6 : 1,
          }}
        >
          <Text style={{ fontSize: 24, fontWeight: '800', color: colores.tinta, minWidth: 36, textAlign: 'center' }}>
            {p.numero}
          </Text>
          <View style={{ flex: 1 }}>
            <Text style={{ fontWeight: '700', fontSize: 15 }}>
              {p.nombre} {p.apellido}
            </Text>
            <Text style={{ color: colores.suave, fontSize: 13 }}>
              {p.nacionalidad}
              {p.fechaNacimiento ? ` · nac. ${formatearFecha(p.fechaNacimiento)}` : ''}
            </Text>
          </View>
          <View style={{ alignItems: 'flex-end', gap: 4 }}>
            <Insignia tono={p.rol === 'TITULAR' ? 'ok' : 'neutro'}>{nombreDeRolPiloto[p.rol]}</Insignia>
            {p.activo === false && <Insignia tono="neutro">Baja</Insignia>}
          </View>
        </View>
      )}
    />
  );
}
