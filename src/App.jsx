// src/App.jsx
import { useState, useEffect, useMemo } from 'react';
import { miLista } from './data/miLista';
import { 
  CheckCircleIcon, 
  CircleIcon, 
  FilmIcon, 
  TvIcon, 
  LayersIcon, 
  ClockIcon,
  ListIcon,
  LayoutGridIcon
} from 'lucide-react';
import { esSerieCompleta, getEpisodiosConOrder } from './utils/seriesUtils';

function App() {
  // ============================================
  // 1. ESTADO: PROGRESO Y MODO DE VISUALIZACIÓN
  // ============================================
  const [progress, setProgress] = useState(() => {
    const saved = localStorage.getItem('mi-tracker');
    if (saved) {
      return JSON.parse(saved);
    }
    
    const initial = {};
    
    miLista.peliculas.forEach(p => { initial[p.id] = false; });
    
    miLista.series.forEach(serie => {
      initial[serie.id] = false;
      serie.temporadas.forEach(temp => {
        initial[temp.id] = false;
        temp.episodios.forEach(ep => {
          initial[ep.id] = false;
        });
      });
    });
    
    return initial;
  });

  const [modoVisualizacion, setModoVisualizacion] = useState('agrupado');

  // ============================================
  // 2. GUARDAR EN LOCALSTORAGE
  // ============================================
  useEffect(() => {
    localStorage.setItem('mi-tracker', JSON.stringify(progress));
  }, [progress]);

  // ============================================
  // 3. FUNCIÓN PARA MARCAR/DESMARCAR
  // ============================================
  const toggleItem = (id) => {
    setProgress(prev => {
      const newProgress = { ...prev };
      const newState = !prev[id];
      newProgress[id] = newState;
      
      updateRelatedItems(id, newState, newProgress);
      
      return newProgress;
    });
  };

  // ============================================
  // 4. ACTUALIZAR RELACIONES (PADRES E HIJOS)
  // ============================================
  const updateRelatedItems = (id, state, progress) => {
    const pelicula = miLista.peliculas.find(p => p.id === id);
    if (pelicula) return;

    for (const serie of miLista.series) {
      if (serie.id === id) {
        serie.temporadas.forEach(temp => {
          progress[temp.id] = state;
          temp.episodios.forEach(ep => {
            progress[ep.id] = state;
          });
        });
        return;
      }

      for (const temp of serie.temporadas) {
        if (temp.id === id) {
          temp.episodios.forEach(ep => {
            progress[ep.id] = state;
          });
          
          const allEpisodesCompleted = temp.episodios.every(ep => progress[ep.id]);
          progress[temp.id] = allEpisodesCompleted;
          
          const allTempsCompleted = serie.temporadas.every(t => progress[t.id]);
          progress[serie.id] = allTempsCompleted;
          
          return;
        }

        for (const ep of temp.episodios) {
          if (ep.id === id) {
            const allEpisodesCompleted = temp.episodios.every(e => progress[e.id]);
            progress[temp.id] = allEpisodesCompleted;
            
            const allTempsCompleted = serie.temporadas.every(t => progress[t.id]);
            progress[serie.id] = allTempsCompleted;
            
            return;
          }
        }
      }
    }
  };

  // ============================================
  // 5. FUNCIONES DE CONTROL
  // ============================================
  const resetAll = () => {
    if (confirm('¿Borrar todo el progreso?')) {
      const reset = {};
      Object.keys(progress).forEach(key => { reset[key] = false; });
      setProgress(reset);
    }
  };

  const markAllWatched = () => {
    if (confirm('¿Marcar todo como visto?')) {
      const allWatched = {};
      Object.keys(progress).forEach(key => { allWatched[key] = true; });
      setProgress(allWatched);
    }
  };

  // ============================================
  // 6. ESTADÍSTICAS
  // ============================================
  const totalItems = Object.keys(progress).length;
  const completedItems = Object.values(progress).filter(v => v).length;
  const percentage = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;

  // ============================================
  // 7. FUNCIÓN PARA GENERAR FORMATO SXXEYY (SOLO PARA EL BADGE)
  // ============================================
  const formatearEpisodio = (ep, temp) => {
    let numTemporada = '';
    let numEpisodio = '';
    
    if (ep.id) {
      const match = ep.id.match(/(\d+)x(\d+)/i);
      if (match) {
        numTemporada = match[1].padStart(2, '0');
        numEpisodio = match[2].padStart(2, '0');
      }
    }
    
    if (!numTemporada && temp && temp.order !== undefined) {
      numTemporada = String(temp.order).padStart(2, '0');
    }
    if (!numEpisodio && ep.order !== undefined) {
      numEpisodio = String(ep.order).padStart(2, '0');
    }
    
    if (!numTemporada) numTemporada = '01';
    if (!numEpisodio) numEpisodio = '01';
    
    return `S${numTemporada}E${numEpisodio}`;
  };

  // ============================================
  // 8. FUNCIÓN PARA EXTRAER NÚMEROS DE EPISODIO
  // ============================================
  const extraerNumerosEpisodio = (ep, temp) => {
    let numTemporada = null;
    let numEpisodio = null;
    
    if (ep.id) {
      const match = ep.id.match(/(\d+)x(\d+)/i);
      if (match) {
        numTemporada = parseInt(match[1]);
        numEpisodio = parseInt(match[2]);
      }
    }
    
    if (!numTemporada && temp && temp.order !== undefined) {
      numTemporada = temp.order;
    }
    if (!numEpisodio && ep.order !== undefined) {
      numEpisodio = ep.order;
    }
    
    return { numTemporada, numEpisodio };
  };

  // ============================================
  // 9. GENERAR LISTA PARA MODO CRONOLÓGICO
  // ============================================
  const listaCronologica = useMemo(() => {
    const items = [];
    
    // Películas
    miLista.peliculas.forEach(p => {
      items.push({
        ...p,
        tipo: 'pelicula',
        nivel: 0,
        serieId: null,
        serieTitle: null,
        temporadaId: null,
        temporadaTitle: null,
        esPadre: false,
        esItemSuelto: true,
        mostrarEstructura: false,
      });
    });
    
    // Series
    miLista.series.forEach(serie => {
      const completa = esSerieCompleta(serie);
      
      // CASO 1: Serie COMPLETA → Mostrar como en modo agrupado (con estructura jerárquica)
      if (completa) {
        // Serie con estructura jerárquica
        items.push({
          id: serie.id,
          title: serie.title,
          tipo: 'serie',
          nivel: 0,
          serieId: null,
          serieTitle: null,
          temporadaId: null,
          temporadaTitle: null,
          esPadre: true,
          esItemSuelto: false,
          mostrarEstructura: true,
          order: serie.order || 0,
          poster: serie.poster,
        });
        
        // Temporadas
        serie.temporadas.forEach(temp => {
          const tipoTemp = temp.episodios.length === 0 ? 'temporada-completa' : 'temporada';
          
          items.push({
            id: temp.id,
            title: temp.title,
            tipo: tipoTemp,
            nivel: 1,
            serieId: serie.id,
            serieTitle: serie.title,
            temporadaId: null,
            temporadaTitle: null,
            esPadre: temp.episodios.length > 0,
            esItemSuelto: false,
            mostrarEstructura: true,
            order: temp.order || 0,
          });
          
          // Episodios
          temp.episodios.forEach(ep => {
            const { numTemporada, numEpisodio } = extraerNumerosEpisodio(ep, temp);
            
            items.push({
              id: ep.id,
              title: ep.title,
              tipo: 'episodio',
              nivel: 2,
              serieId: serie.id,
              serieTitle: serie.title,
              temporadaId: temp.id,
              temporadaTitle: temp.title,
              esPadre: false,
              esItemSuelto: false,
              mostrarEstructura: true,
              order: ep.order || 0,
              numeroTemporada: numTemporada,
              numeroEpisodio: numEpisodio,
            });
          });
        });
      } 
      
      // CASO 2: Serie INCOMPLETA → Mostrar como items sueltos
      else {
        // Serie como item suelto (sin desplegable)
        items.push({
          id: serie.id,
          title: serie.title,
          tipo: 'serie',
          nivel: 0,
          serieId: null,
          serieTitle: null,
          temporadaId: null,
          temporadaTitle: null,
          esPadre: false,
          esItemSuelto: false,
          mostrarEstructura: false,
          order: serie.order || 0,
          poster: serie.poster,
        });
        
        // Episodios sueltos
        const episodiosConOrder = getEpisodiosConOrder(serie);
        episodiosConOrder.forEach(ep => {
          const temp = serie.temporadas.find(t => t.id === ep.temporadaId);
          const formatoEpisodio = temp ? formatearEpisodio(ep, temp) : '';
          
          items.push({
            id: ep.id,
            title: `${serie.title} - ${ep.title}`,
            tipo: 'episodio-suelto',
            nivel: 0,
            serieId: serie.id,
            serieTitle: serie.title,
            temporadaId: ep.temporadaId,
            temporadaTitle: ep.temporadaTitle,
            esPadre: false,
            esItemSuelto: true,
            mostrarEstructura: false,
            order: ep.order || 0,
            poster: ep.poster,
            formatoEpisodio: formatoEpisodio,
          });
        });
      }
    });
    
    return items.sort((a, b) => (a.order || 0) - (b.order || 0));
  }, []);

  // ============================================
  // 10. OBTENER ICONO Y COLOR SEGÚN TIPO
  // ============================================
  const getTypeIcon = (tipo) => {
    if (tipo === 'pelicula') return <FilmIcon className="w-4 h-4" />;
    if (tipo === 'serie') return <LayersIcon className="w-4 h-4" />;
    if (tipo === 'temporada') return <TvIcon className="w-4 h-4" />;
    if (tipo === 'temporada-completa') return <TvIcon className="w-4 h-4" />;
    if (tipo === 'episodio' || tipo === 'episodio-suelto') return <ClockIcon className="w-4 h-4" />;
    return null;
  };

  const getTypeColor = (tipo) => {
    if (tipo === 'pelicula') return 'bg-purple-500/20 text-purple-400 border-purple-500/30';
    if (tipo === 'serie') return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
    if (tipo === 'temporada') return 'bg-orange-500/20 text-orange-400 border-orange-500/30';
    if (tipo === 'temporada-completa') return 'bg-green-500/20 text-green-400 border-green-500/30';
    if (tipo === 'episodio') return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
    if (tipo === 'episodio-suelto') return 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30';
    return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
  };

  const getTypeLabel = (tipo) => {
    if (tipo === 'pelicula') return 'Película';
    if (tipo === 'serie') return 'Serie';
    if (tipo === 'temporada') return 'Temporada';
    if (tipo === 'temporada-completa') return 'Temp. Completa';
    if (tipo === 'episodio') return 'Episodio';
    if (tipo === 'episodio-suelto') return 'Episodio';
    return 'Item';
  };

  // ============================================
  // 11. RENDERIZADO
  // ============================================
  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0a0a0a] to-[#1a1a2e] text-white">
      {/* HEADER - FIJO (sticky) */}
      <header className="sticky top-0 z-10 bg-[#0a0a0a]/90 backdrop-blur-lg border-b border-yellow-500/20">
        <div className="max-w-4xl mx-auto px-4 py-3">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-2">
            {/* Título y estadísticas */}
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <div>
                <h1 className="text-xl md:text-2xl font-bold bg-gradient-to-r from-yellow-400 to-yellow-600 bg-clip-text text-transparent">
                  🎬 Star Wars Tracker
                </h1>
                <p className="text-xs text-gray-400 hidden sm:block">
                  {modoVisualizacion === 'agrupado' ? '📦 Modo Agrupado' : '📋 Modo Cronológico'} • {totalItems} elementos
                </p>
              </div>
            </div>

            {/* Controles - Switch de modo FIJO en el header */}
            <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
              {/* Switch de modo */}
              <div className="flex gap-1 bg-gray-800/50 p-1 rounded-lg border border-gray-700/50">
                <button
                  onClick={() => setModoVisualizacion('agrupado')}
                  className={`
                    flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs md:text-sm transition-all duration-200
                    ${modoVisualizacion === 'agrupado' 
                      ? 'bg-yellow-500/20 text-yellow-400' 
                      : 'text-gray-400 hover:text-white hover:bg-gray-700/30'}
                  `}
                >
                  <LayoutGridIcon className="w-3.5 h-3.5 md:w-4 md:h-4" />
                  <span className="hidden xs:inline">Agrupado</span>
                </button>
                <button
                  onClick={() => setModoVisualizacion('cronologico')}
                  className={`
                    flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs md:text-sm transition-all duration-200
                    ${modoVisualizacion === 'cronologico' 
                      ? 'bg-yellow-500/20 text-yellow-400' 
                      : 'text-gray-400 hover:text-white hover:bg-gray-700/30'}
                  `}
                >
                  <ListIcon className="w-3.5 h-3.5 md:w-4 md:h-4" />
                  <span className="hidden xs:inline">Cronológico</span>
                </button>
              </div>

              {/* Botones de control - Movidos al header */}
              <div className="flex gap-1.5">
                <button
                  onClick={markAllWatched}
                  className="px-2.5 py-1.5 text-xs bg-green-600/30 hover:bg-green-600/50 text-green-400 rounded-lg transition-colors"
                  title="Marcar todo como visto"
                >
                  <span className="hidden sm:inline">Marcar todo</span>
                  <span className="sm:hidden">✅</span>
                </button>
                <button
                  onClick={resetAll}
                  className="px-2.5 py-1.5 text-xs bg-red-600/30 hover:bg-red-600/50 text-red-400 rounded-lg transition-colors"
                  title="Resetear progreso"
                >
                  <span className="hidden sm:inline">Resetear</span>
                  <span className="sm:hidden">🗑️</span>
                </button>
              </div>
            </div>
          </div>

          {/* Barra de progreso - Siempre visible en el header */}
          <div className="mt-2 flex items-center gap-3">
            <div className="flex-1 bg-gray-800/50 rounded-full h-2 overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-yellow-400 to-yellow-600 transition-all duration-500"
                style={{ width: `${percentage}%` }}
              />
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <span className="text-xs font-bold text-yellow-400">{percentage}%</span>
              <span className="text-xs text-gray-400">{completedItems}/{totalItems}</span>
            </div>
          </div>
        </div>
      </header>

      {/* CONTENIDO */}
      <main className="max-w-4xl mx-auto px-4 py-6">
        {/* ========================================== */}
        {/* MODO AGRUPADO */}
        {/* ========================================== */}
        {modoVisualizacion === 'agrupado' && (
          <>
            {/* PELÍCULAS */}
            {miLista.peliculas.length > 0 && (
              <div className="mb-8">
                <h2 className="text-sm font-bold text-purple-400 mb-2 flex items-center gap-2">
                  <span>🎬 Películas</span>
                  <span className="text-xs text-gray-500 font-normal">({miLista.peliculas.length})</span>
                </h2>
                <div className="space-y-2">
                  {miLista.peliculas.map((pelicula) => (
                    <ItemRow
                      key={pelicula.id}
                      id={pelicula.id}
                      title={pelicula.title}
                      completed={progress[pelicula.id] || false}
                      onToggle={toggleItem}
                      tipo="pelicula"
                      nivel={0}
                      poster={pelicula.poster}
                      mostrarPoster={true}
                      modo="agrupado"
                    />
                  ))}
                </div>
              </div>
            )}

            {/* SERIES */}
            {miLista.series.map((serie) => {
              const serieCompleted = progress[serie.id] || false;
              let totalEpisodios = 0;
              let episodiosCompletados = 0;
              
              serie.temporadas.forEach(temp => {
                totalEpisodios += temp.episodios.length;
                temp.episodios.forEach(ep => {
                  if (progress[ep.id]) episodiosCompletados++;
                });
              });

              return (
                <div key={serie.id} className="mb-8">
                  {/* SERIE */}
                  <div 
                    onClick={() => toggleItem(serie.id)}
                    className={`
                      flex items-center gap-3 p-4 rounded-xl cursor-pointer transition-all duration-200
                      ${serieCompleted 
                        ? 'bg-green-900/30 border-2 border-green-500/40' 
                        : 'bg-yellow-900/20 border-2 border-yellow-500/30 hover:bg-yellow-900/30'
                      }
                    `}
                  >
                    <div className="flex-shrink-0">
                      {serieCompleted ? (
                        <CheckCircleIcon className="w-6 h-6 text-green-400" />
                      ) : (
                        <CircleIcon className="w-6 h-6 text-gray-500" />
                      )}
                    </div>
                    <div className="flex-1">
                      <span className={`text-lg font-bold ${serieCompleted ? 'text-gray-300 line-through' : 'text-yellow-400'}`}>
                        {serie.title}
                      </span>
                      {totalEpisodios > 0 && (
                        <span className="text-xs text-gray-400 ml-3">
                          ({episodiosCompletados}/{totalEpisodios} episodios)
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-gray-500">
                      {serie.temporadas.length} {serie.temporadas.length === 1 ? 'temporada' : 'temporadas'}
                    </div>
                  </div>

                  {/* TEMPORADAS */}
                  <div className="ml-6 mt-3 space-y-3">
                    {serie.temporadas.map((temporada) => {
                      const tempCompleted = progress[temporada.id] || false;
                      const episodiosTemp = temporada.episodios;
                      const episodiosCompletadosTemp = episodiosTemp.filter(e => progress[e.id]).length;

                      return (
                        <div key={temporada.id}>
                          {/* TEMPORADA */}
                          <div 
                            onClick={() => toggleItem(temporada.id)}
                            className={`
                              flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all duration-200
                              ${tempCompleted 
                                ? 'bg-green-900/20 border border-green-500/30' 
                                : 'bg-gray-800/30 border border-gray-700/50 hover:bg-gray-800/50'
                              }
                            `}
                          >
                            <div className="flex-shrink-0">
                              {tempCompleted ? (
                                <CheckCircleIcon className="w-5 h-5 text-green-400" />
                              ) : (
                                <CircleIcon className="w-5 h-5 text-gray-500" />
                              )}
                            </div>
                            <div className="flex-1">
                              <span className={`text-sm font-medium ${tempCompleted ? 'text-gray-300 line-through' : 'text-white'}`}>
                                {temporada.title}
                              </span>
                              {episodiosTemp.length > 0 && (
                                <span className="text-xs text-gray-400 ml-2">
                                  ({episodiosCompletadosTemp}/{episodiosTemp.length})
                                </span>
                              )}
                            </div>
                            {episodiosTemp.length === 0 && (
                              <div className="text-xs text-gray-500">Sin episodios</div>
                            )}
                          </div>

                          {/* EPISODIOS */}
                          {episodiosTemp.length > 0 && (
                            <div className="ml-6 mt-1 space-y-1">
                              {episodiosTemp.map((episodio) => (
                                <ItemRow
                                  key={episodio.id}
                                  id={episodio.id}
                                  title={episodio.title}
                                  completed={progress[episodio.id] || false}
                                  onToggle={toggleItem}
                                  tipo="episodio"
                                  nivel={2}
                                  mostrarPoster={false}
                                  modo="agrupado"
                                />
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </>
        )}

        {/* ========================================== */}
        {/* MODO CRONOLÓGICO */}
        {/* ========================================== */}
        {modoVisualizacion === 'cronologico' && (
          <div className="space-y-2">
            {listaCronologica.length === 0 ? (
              <p className="text-center text-gray-500 py-10">
                No hay elementos para mostrar
              </p>
            ) : (
              listaCronologica.map((item) => {
                const completed = progress[item.id] || false;

                // ==========================================
                // Serie CON estructura jerárquica (completa)
                // Se muestra igual que en el modo agrupado con menú cascada
                // ==========================================
                if (item.mostrarEstructura && item.tipo === 'serie') {
                  return (
                    <div key={item.id} className="mb-6">
                      {/* Serie con poster y estilo igual al modo agrupado */}
                      <div 
                        onClick={() => toggleItem(item.id)}
                        className={`
                          flex items-center gap-3 p-4 rounded-xl cursor-pointer transition-all duration-200
                          ${progress[item.id] 
                            ? 'bg-green-900/30 border-2 border-green-500/40' 
                            : 'bg-yellow-900/20 border-2 border-yellow-500/30 hover:bg-yellow-900/30'
                          }
                        `}
                      >
                        <div className="flex-shrink-0">
                          {progress[item.id] ? (
                            <CheckCircleIcon className="w-6 h-6 text-green-400" />
                          ) : (
                            <CircleIcon className="w-6 h-6 text-gray-500" />
                          )}
                        </div>
                        {/* Poster de la serie */}
                        {item.poster && (
                          <div className="flex-shrink-0 w-12 h-16 rounded-md overflow-hidden border border-gray-700/50">
                            <img 
                              src={item.poster} 
                              alt={item.title}
                              className="w-full h-full object-cover"
                              loading="lazy"
                              onError={(e) => {
                                e.target.style.display = 'none';
                              }}
                            />
                          </div>
                        )}
                        <div className="flex-1">
                          <span className={`text-lg font-bold ${progress[item.id] ? 'text-gray-300 line-through' : 'text-yellow-400'}`}>
                            {item.title}
                          </span>
                          {/* Contar episodios de la serie */}
                          {(() => {
                            const episodiosDeSerie = listaCronologica.filter(i => i.serieId === item.id && i.tipo === 'episodio');
                            const completados = episodiosDeSerie.filter(i => progress[i.id]).length;
                            return episodiosDeSerie.length > 0 && (
                              <span className="text-xs text-gray-400 ml-3">
                                ({completados}/{episodiosDeSerie.length} episodios)
                              </span>
                            );
                          })()}
                        </div>
                        <div className="text-xs text-gray-500">
                          {listaCronologica.filter(i => i.serieId === item.id && i.tipo === 'temporada').length} temporadas
                        </div>
                      </div>

                      {/* Temporadas y episodios con menú cascada (igual que modo agrupado) */}
                      <div className="ml-6 mt-3 space-y-3">
                        {listaCronologica
                          .filter(i => i.serieId === item.id && i.tipo === 'temporada')
                          .sort((a, b) => (a.order || 0) - (b.order || 0))
                          .map((temporada) => {
                            const tempCompleted = progress[temporada.id] || false;
                            const episodiosDeTemp = listaCronologica.filter(i => i.temporadaId === temporada.id && i.tipo === 'episodio');
                            const episodiosCompletadosTemp = episodiosDeTemp.filter(i => progress[i.id]).length;

                            return (
                              <div key={temporada.id}>
                                {/* TEMPORADA */}
                                <div 
                                  onClick={() => toggleItem(temporada.id)}
                                  className={`
                                    flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all duration-200
                                    ${tempCompleted 
                                      ? 'bg-green-900/20 border border-green-500/30' 
                                      : 'bg-gray-800/30 border border-gray-700/50 hover:bg-gray-800/50'
                                    }
                                  `}
                                >
                                  <div className="flex-shrink-0">
                                    {tempCompleted ? (
                                      <CheckCircleIcon className="w-5 h-5 text-green-400" />
                                    ) : (
                                      <CircleIcon className="w-5 h-5 text-gray-500" />
                                    )}
                                  </div>
                                  <div className="flex-1">
                                    <span className={`text-sm font-medium ${tempCompleted ? 'text-gray-300 line-through' : 'text-white'}`}>
                                      {temporada.title}
                                    </span>
                                    {episodiosDeTemp.length > 0 && (
                                      <span className="text-xs text-gray-400 ml-2">
                                        ({episodiosCompletadosTemp}/{episodiosDeTemp.length})
                                      </span>
                                    )}
                                  </div>
                                  {episodiosDeTemp.length === 0 && (
                                    <div className="text-xs text-gray-500">Sin episodios</div>
                                  )}
                                </div>

                                {/* EPISODIOS */}
                                {episodiosDeTemp.length > 0 && (
                                  <div className="ml-6 mt-1 space-y-1">
                                    {episodiosDeTemp.map((episodio) => (
                                      <ItemRow
                                        key={episodio.id}
                                        id={episodio.id}
                                        title={episodio.title}
                                        completed={progress[episodio.id] || false}
                                        onToggle={toggleItem}
                                        tipo="episodio"
                                        nivel={2}
                                        poster={episodio.poster}
                                        mostrarPoster={false}
                                        modo="cronologico"
                                        numeroTemporada={episodio.numeroTemporada}
                                        numeroEpisodio={episodio.numeroEpisodio}
                                      />
                                    ))}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                      </div>
                    </div>
                  );
                }

                // ==========================================
                // Episodio suelto (con poster y badge)
                // ==========================================
                if (item.tipo === 'episodio-suelto') {
                  return (
                    <ItemRow
                      key={item.id}
                      id={item.id}
                      title={item.title}
                      completed={completed}
                      onToggle={toggleItem}
                      tipo="episodio-suelto"
                      nivel={0}
                      poster={item.poster}
                      mostrarPoster={true}
                      modo="cronologico"
                      serieTitle={item.serieTitle}
                      formatoEpisodio={item.formatoEpisodio}
                    />
                  );
                }

                // ==========================================
                // Películas (con poster)
                // ==========================================
                if (item.tipo === 'pelicula') {
                  return (
                    <ItemRow
                      key={item.id}
                      id={item.id}
                      title={item.title}
                      completed={completed}
                      onToggle={toggleItem}
                      tipo="pelicula"
                      nivel={0}
                      poster={item.poster}
                      mostrarPoster={true}
                      modo="cronologico"
                    />
                  );
                }

                // ==========================================
                // Series incompletas (sin estructura)
                // ==========================================
                if (item.tipo === 'serie' && !item.mostrarEstructura) {
                  return (
                    <ItemRow
                      key={item.id}
                      id={item.id}
                      title={item.title}
                      completed={completed}
                      onToggle={toggleItem}
                      tipo="serie"
                      nivel={0}
                      poster={item.poster}
                      mostrarPoster={true}
                      modo="cronologico"
                      esPadre={false}
                    />
                  );
                }

                // ==========================================
                // Cualquier otro item (fallback)
                // ==========================================
                return (
                  <ItemRow
                    key={item.id}
                    id={item.id}
                    title={item.title}
                    completed={completed}
                    onToggle={toggleItem}
                    tipo={item.tipo}
                    nivel={item.nivel || 0}
                    poster={item.poster}
                    mostrarPoster={false}
                    modo="cronologico"
                  />
                );
              })
            )}
          </div>
        )}

        {/* FOOTER */}
        <footer className="mt-8 text-center text-xs text-gray-600 border-t border-gray-800/50 pt-4">
          Progreso guardado automáticamente en tu navegador
        </footer>
      </main>
    </div>
  );
}

// ============================================
// 12. COMPONENTE PARA FILAS
// ============================================
function ItemRow({ 
  id, 
  title, 
  completed, 
  onToggle, 
  tipo, 
  nivel = 0, 
  poster, 
  mostrarPoster = true,
  modo = 'agrupado',
  serieTitle = null,
  esPadre = false,
  formatoEpisodio = null,
  numeroTemporada = null,
  numeroEpisodio = null,
}) {
  const getTypeColor = (tipo) => {
    if (tipo === 'pelicula') return 'bg-purple-500/20 text-purple-400 border-purple-500/30';
    if (tipo === 'serie') return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
    if (tipo === 'temporada') return 'bg-orange-500/20 text-orange-400 border-orange-500/30';
    if (tipo === 'temporada-completa') return 'bg-green-500/20 text-green-400 border-green-500/30';
    if (tipo === 'episodio') return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
    if (tipo === 'episodio-suelto') return 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30';
    return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
  };

  const getTypeLabel = (tipo) => {
    if (tipo === 'pelicula') return 'Película';
    if (tipo === 'serie') return 'Serie';
    if (tipo === 'temporada') return 'Temporada';
    if (tipo === 'temporada-completa') return 'Temp. Completa';
    if (tipo === 'episodio') return 'Episodio';
    if (tipo === 'episodio-suelto') return 'Episodio';
    return 'Item';
  };

  // Generar formato SXXEYY
  const generarFormatoEpisodio = () => {
    if (tipo === 'episodio-suelto' && formatoEpisodio) {
      return formatoEpisodio;
    }
    if (tipo === 'episodio' && numeroTemporada && numeroEpisodio) {
      const temp = String(numeroTemporada).padStart(2, '0');
      const ep = String(numeroEpisodio).padStart(2, '0');
      return `S${temp}E${ep}`;
    }
    return null;
  };

  const badgeFormato = generarFormatoEpisodio();

  // Mostrar badge SOLO en modo cronológico
  const mostrarBadge = badgeFormato && (tipo === 'episodio' || tipo === 'episodio-suelto') && modo === 'cronologico';

  // Mostrar poster según modo
  const debeMostrarPoster = (() => {
    if (!mostrarPoster || !poster) return false;
    
    if (modo === 'agrupado') {
      return tipo === 'pelicula' || tipo === 'serie';
    } else if (modo === 'cronologico') {
      return tipo === 'pelicula' || tipo === 'serie' || tipo === 'episodio-suelto';
    }
    return false;
  })();

  const indentClass = nivel === 0 ? 'ml-0' : nivel === 1 ? 'ml-6' : 'ml-12';
  const colorClass = getTypeColor(tipo);
  const typeLabel = getTypeLabel(tipo);

  return (
    <div
      onClick={() => onToggle(id)}
      className={`
        flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all duration-200
        ${completed 
          ? 'bg-green-900/20 border border-green-500/30 hover:bg-green-900/30' 
          : `bg-gray-800/30 border border-gray-700/50 hover:bg-gray-800/50 hover:border-gray-600`
        }
        ${indentClass}
        ${debeMostrarPoster ? 'pl-2' : ''}
        ${esPadre ? 'border-l-4 border-l-yellow-500/30' : ''}
      `}
    >
      {/* POSTER */}
      {debeMostrarPoster && (
        <div className="flex-shrink-0 w-12 h-16 rounded-md overflow-hidden border border-gray-700/50">
          <img 
            src={poster} 
            alt={title}
            className="w-full h-full object-cover"
            loading="lazy"
            onError={(e) => {
              e.target.style.display = 'none';
            }}
          />
        </div>
      )}

      {/* Checkbox */}
      <div className="flex-shrink-0">
        {completed ? (
          <CheckCircleIcon className="w-5 h-5 text-green-400" />
        ) : (
          <CircleIcon className="w-5 h-5 text-gray-500" />
        )}
      </div>

      {/* Título */}
      <div className="flex-1">
        <span className={`text-sm ${completed ? 'text-gray-300 line-through' : 'text-white'}`}>
          {title}
        </span>
        
        {/* Badge SXXEYY - SOLO en modo cronológico */}
        {mostrarBadge && (
          <span className="text-xs bg-yellow-500/20 text-yellow-400 px-2 py-0.5 rounded-full ml-2">
            {badgeFormato}
          </span>
        )}
        
        {/* Serie de origen en episodios sueltos */}
        {tipo === 'episodio-suelto' && serieTitle && (
          <span className="text-xs text-gray-500 ml-2">
            ← {serieTitle}
          </span>
        )}
      </div>

      {/* Badge de tipo */}
      <div className="flex-shrink-0">
        <span className={`
          text-xs px-2 py-0.5 rounded-full
          ${colorClass}
        `}>
          {typeLabel}
        </span>
      </div>
    </div>
  );
}

export default App;