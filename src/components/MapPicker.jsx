import { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { MapPin, Search, X } from 'lucide-react'

// Os ícones por omissão do Leaflet quebram com bundlers (URLs relativos). Aponta
// para o CDN uma única vez ao carregar o módulo.
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

// Centro por omissão (Lisboa) quando ainda não há ponto escolhido.
const DEFAULT_CENTER = [38.7223, -9.1393]

function googleMapsUrl(lat, lng) {
  return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`
}

/**
 * MapPicker — mapa interativo (Leaflet + OpenStreetMap) para escolher um ponto,
 * por clique no mapa ou pesquisa de morada (Nominatim). Não requer chave de API.
 * `value` = { lat, lng, url } | null. `onChange(next|null)` devolve o ponto
 * escolhido com um link do Google Maps pronto a mostrar no evento.
 */
export default function MapPicker({ value, onChange, address }) {
  const mapRef = useRef(null)
  const mapObj = useRef(null)
  const markerRef = useRef(null)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [searching, setSearching] = useState(false)

  // Inicializa o mapa uma única vez (limpa no unmount / StrictMode).
  useEffect(() => {
    if (mapObj.current || !mapRef.current) return
    const hasPoint = value?.lat != null && value?.lng != null
    const start = hasPoint ? [value.lat, value.lng] : DEFAULT_CENTER
    const map = L.map(mapRef.current).setView(start, hasPoint ? 15 : 11)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap',
      maxZoom: 19,
    }).addTo(map)
    map.on('click', (e) => commit(e.latlng.lat, e.latlng.lng))
    mapObj.current = map
    if (hasPoint) placeMarker(value.lat, value.lng)
    // Dentro de um modal o contentor só ganha tamanho depois de montar.
    const t = setTimeout(() => map.invalidateSize(), 120)
    return () => {
      clearTimeout(t)
      map.remove()
      mapObj.current = null
      markerRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function placeMarker(lat, lng) {
    if (!mapObj.current) return
    if (markerRef.current) markerRef.current.setLatLng([lat, lng])
    else markerRef.current = L.marker([lat, lng]).addTo(mapObj.current)
  }

  function commit(lat, lng, recenter = false) {
    placeMarker(lat, lng)
    if (recenter && mapObj.current) mapObj.current.setView([lat, lng], 16)
    onChange({ lat, lng, url: googleMapsUrl(lat, lng) })
  }

  async function runSearch(term) {
    const q = (term ?? query).trim()
    if (!q) return
    setSearching(true)
    setResults([])
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&q=${encodeURIComponent(q)}`,
        { headers: { Accept: 'application/json' } }
      )
      const data = await res.json()
      setResults(Array.isArray(data) ? data : [])
    } catch {
      setResults([])
    } finally {
      setSearching(false)
    }
  }

  function choose(r) {
    setQuery(r.display_name)
    setResults([])
    commit(Number(r.lat), Number(r.lon), true)
  }

  function clear() {
    if (markerRef.current && mapObj.current) {
      mapObj.current.removeLayer(markerRef.current)
      markerRef.current = null
    }
    onChange(null)
  }

  const hasPoint = value?.lat != null && value?.lng != null

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <input
            className="w-full rounded-lg border border-input bg-background py-2 pl-8 pr-2.5 text-[13px] text-foreground outline-none focus:border-ring"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                runSearch()
              }
            }}
            placeholder="Procurar morada ou local…"
          />
        </div>
        <button
          type="button"
          className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-border bg-transparent px-3 py-2 text-[13px] font-semibold text-foreground transition-colors hover:bg-accent disabled:opacity-50"
          onClick={() => runSearch()}
          disabled={searching}
        >
          {searching ? 'A procurar…' : 'Procurar'}
        </button>
        {address ? (
          <button
            type="button"
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-border bg-transparent px-3 py-2 text-[13px] font-semibold text-foreground transition-colors hover:bg-accent disabled:opacity-50"
            onClick={() => {
              setQuery(address)
              runSearch(address)
            }}
            disabled={searching}
            title="Procurar pela morada indicada"
          >
            Usar morada
          </button>
        ) : null}
      </div>

      {results.length > 0 && (
        <ul className="max-h-40 overflow-y-auto rounded-lg border border-border bg-background text-[13px]">
          {results.map((r) => (
            <li key={`${r.place_id}`}>
              <button
                type="button"
                className="block w-full cursor-pointer truncate px-3 py-2 text-left text-foreground transition-colors hover:bg-accent"
                onClick={() => choose(r)}
                title={r.display_name}
              >
                {r.display_name}
              </button>
            </li>
          ))}
        </ul>
      )}

      <div ref={mapRef} className="h-[260px] w-full overflow-hidden rounded-lg border border-border" />

      {hasPoint ? (
        <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
          <a
            href={value.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-w-0 items-center gap-1.5 font-semibold text-primary underline underline-offset-2 hover:opacity-80"
          >
            <MapPin className="h-3.5 w-3.5 flex-shrink-0" aria-hidden="true" />
            <span className="truncate">
              Ver no Google Maps ({value.lat.toFixed(5)}, {value.lng.toFixed(5)})
            </span>
          </a>
          <button
            type="button"
            className="inline-flex flex-shrink-0 cursor-pointer items-center gap-1 rounded-md px-1.5 py-1 font-semibold text-destructive transition-colors hover:bg-destructive/10"
            onClick={clear}
          >
            <X className="h-3.5 w-3.5" aria-hidden="true" />
            Remover
          </button>
        </div>
      ) : (
        <p className="text-[11px] font-medium text-muted-foreground">
          Clique no mapa ou procure uma morada para escolher a localização.
        </p>
      )}
    </div>
  )
}
