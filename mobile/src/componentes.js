import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { acentoPorRol, colores, etiquetaDePanel, reglasDePassword } from './tema';

export function Encabezado({ rol = 'ANONIMO', usuario }) {
  const { top } = useSafeAreaInsets();
  return (
    <View style={[estilos.encabezado, { paddingTop: top + 10, borderBottomColor: acentoPorRol[rol] }]}>
      <View style={estilos.marca}>
        <Bandera />
        <View>
          <Text style={estilos.marcaTitulo}>Plataforma Integral FIA</Text>
          <Text style={estilos.marcaSub}>F1 · F2 · F3 · F1 Academy</Text>
        </View>
      </View>
      {usuario && (
        <View style={estilos.filaEncabezado}>
          <Text style={[estilos.panel, { backgroundColor: acentoPorRol[rol] }]}>{etiquetaDePanel[rol]}</Text>
          <Text style={estilos.usuarioActual} numberOfLines={1}>
            {usuario.nombre} {usuario.apellido}
          </Text>
        </View>
      )}
    </View>
  );
}


export function Bandera({ lado = 6 }) {
  const filas = [0, 1, 2];
  const columnas = [0, 1, 2, 3];
  return (
    <View style={[estilos.bandera, { padding: lado * 0.6 }]}>
      <View style={{ width: lado * 0.45, height: lado * 4.6, backgroundColor: '#fff', borderRadius: 2, marginRight: 2 }} />
      <View>
        {filas.map((f) => (
          <View key={f} style={{ flexDirection: 'row' }}>
            {columnas.map((c) => (
              <View key={c} style={{ width: lado, height: lado, backgroundColor: (f + c) % 2 === 0 ? '#fff' : colores.tinta }} />
            ))}
          </View>
        ))}
      </View>
    </View>
  );
}

export function Boton({ titulo, alPresionar, tipo = 'primario', deshabilitado, acento = colores.rojo, chico }) {
  const estiloTipo =
    tipo === 'primario'
      ? { backgroundColor: acento, borderColor: acento }
      : tipo === 'peligro'
        ? { backgroundColor: colores.superficie, borderColor: '#f0b9b3' }
        : { backgroundColor: colores.superficie, borderColor: colores.bordeFuerte };
  const colorTexto = tipo === 'primario' ? '#fff' : tipo === 'peligro' ? colores.error : colores.texto;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={alPresionar}
      disabled={deshabilitado}
      style={({ pressed }) => [
        estilos.boton,
        chico && estilos.botonChico,
        estiloTipo,
        (pressed || deshabilitado) && { opacity: deshabilitado ? 0.5 : 0.8 },
      ]}
    >
      <Text style={[estilos.botonTexto, { color: colorTexto }, chico && { fontSize: 13 }]}>{titulo}</Text>
    </Pressable>
  );
}

export function Enlace({ titulo, alPresionar }) {
  return (
    <Pressable onPress={alPresionar} accessibilityRole="link" hitSlop={8}>
      <Text style={estilos.enlace}>{titulo}</Text>
    </Pressable>
  );
}

export function Campo({ etiqueta, error, ...props }) {
  return (
    <View style={estilos.campo}>
      <Text style={estilos.campoEtiqueta}>{etiqueta}</Text>
      <TextInput
        placeholderTextColor={colores.suave}
        autoCorrect={false}
        style={[estilos.entrada, error && { borderColor: colores.error, backgroundColor: '#fffafa' }]}
        {...props}
      />
      {error ? <Text style={estilos.campoError}>{error}</Text> : null}
    </View>
  );
}

const TONOS = {
  info: [colores.infoFondo, colores.info],
  ok: [colores.okFondo, colores.ok],
  aviso: [colores.avisoFondo, colores.aviso],
  error: [colores.errorFondo, colores.error],
  neutro: [colores.neutroFondo, colores.neutro],
};

export function Aviso({ tono = 'info', children }) {
  if (!children) return null;
  const [fondo, texto] = TONOS[tono];
  return (
    <View style={[estilos.aviso, { backgroundColor: fondo }]}>
      <Text style={{ color: texto, fontSize: 14 }}>{children}</Text>
    </View>
  );
}

export function Insignia({ tono = 'neutro', children }) {
  const [fondo, texto] = TONOS[tono];
  return (
    <View style={[estilos.insignia, { backgroundColor: fondo }]}>
      <Text style={[estilos.insigniaTexto, { color: texto }]}>{children}</Text>
    </View>
  );
}

export function Chips({ opciones, valor, alCambiar }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={estilos.chips}>
      {opciones.map((opcion) => {
        const activa = opcion.valor === valor;
        return (
          <Pressable
            key={String(opcion.valor)}
            onPress={() => alCambiar(opcion.valor)}
            style={[estilos.chip, activa && estilos.chipActiva]}
            accessibilityRole="tab"
            accessibilityState={{ selected: activa }}
          >
            <Text style={[estilos.chipTexto, activa && { color: '#fff' }]}>{opcion.texto}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

export function ChecklistPassword({ password, minLongitud }) {
  return (
    <View style={estilos.checklist}>
      {reglasDePassword(password, minLongitud).map((regla) => (
        <Text key={regla.codigo} style={[estilos.checklistItem, regla.cumple && { color: colores.ok, fontWeight: '600' }]}>
          {regla.cumple ? '✓' : '○'} {regla.descripcion}
        </Text>
      ))}
    </View>
  );
}

export function Cargando({ texto = 'Cargando…' }) {
  return (
    <View style={estilos.cargando}>
      <ActivityIndicator color={colores.rojo} />
      <Text style={{ color: colores.suave, marginTop: 8 }}>{texto}</Text>
    </View>
  );
}

export function BarraDePestanias({ pestanias, activa, alCambiar, acento }) {
  const { bottom } = useSafeAreaInsets();
  return (
    <View style={[estilos.barra, { paddingBottom: Math.max(bottom, 8) }]}>
      {pestanias.map((p) => {
        const esActiva = p.clave === activa;
        return (
          <Pressable
            key={p.clave}
            style={estilos.pestania}
            onPress={() => alCambiar(p.clave)}
            accessibilityRole="tab"
            accessibilityState={{ selected: esActiva }}
          >
            <Text style={[estilos.pestaniaIcono, esActiva && { color: acento }]}>{p.icono}</Text>
            <Text style={[estilos.pestaniaTexto, esActiva && { color: acento, fontWeight: '700' }]}>{p.titulo}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export const estilos = StyleSheet.create({
  encabezado: { backgroundColor: colores.tinta, paddingHorizontal: 18, paddingBottom: 12, borderBottomWidth: 3 },
  marca: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  marcaTitulo: { color: '#fff', fontWeight: '700', fontSize: 17 },
  marcaSub: { color: colores.claroSobreOscuro, fontSize: 12 },
  filaEncabezado: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10, gap: 10 },
  panel: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 11,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 999,
    overflow: 'hidden',
  },
  usuarioActual: { color: '#fff', fontWeight: '600', flexShrink: 1 },
  bandera: { flexDirection: 'row', backgroundColor: colores.rojo, borderRadius: 8 },
  boton: {
    borderWidth: 1,
    borderRadius: 9,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  botonChico: { paddingVertical: 7, paddingHorizontal: 12 },
  botonTexto: { fontWeight: '700', fontSize: 15 },
  enlace: { color: colores.info, textDecorationLine: 'underline', fontSize: 14 },
  campo: { marginBottom: 12 },
  campoEtiqueta: { fontWeight: '600', marginBottom: 5, color: colores.texto },
  entrada: {
    borderWidth: 1,
    borderColor: colores.bordeFuerte,
    borderRadius: 9,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    backgroundColor: '#fff',
    color: colores.texto,
  },
  campoError: { color: colores.error, fontSize: 13, marginTop: 4 },
  aviso: { borderRadius: 9, padding: 12, marginBottom: 12 },
  insignia: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3, alignSelf: 'flex-start' },
  insigniaTexto: { fontSize: 12, fontWeight: '700' },
  chips: { gap: 8, paddingVertical: 4, paddingRight: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colores.borde,
    backgroundColor: colores.superficie,
  },
  chipActiva: { backgroundColor: colores.tinta, borderColor: colores.tinta },
  chipTexto: { fontWeight: '600', color: colores.suave },
  checklist: { marginTop: -4, marginBottom: 12 },
  checklistItem: { color: colores.suave, fontSize: 13, marginBottom: 2 },
  cargando: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 30 },
  barra: {
    flexDirection: 'row',
    backgroundColor: colores.superficie,
    borderTopWidth: 1,
    borderTopColor: colores.borde,
    paddingTop: 8,
  },
  pestania: { flex: 1, alignItems: 'center', gap: 2 },
  pestaniaIcono: { fontSize: 18, color: colores.suave },
  pestaniaTexto: { fontSize: 12, color: colores.suave },
  tarjeta: {
    backgroundColor: colores.superficie,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colores.borde,
    padding: 18,
    marginBottom: 14,
  },
  titulo: { fontSize: 22, fontWeight: '700', color: colores.tinta, marginBottom: 6 },
  subtitulo: { color: colores.suave, marginBottom: 14, fontSize: 14 },
  pantalla: { flex: 1, backgroundColor: colores.fondo },
  contenido: { padding: 16, paddingBottom: 32 },
});
