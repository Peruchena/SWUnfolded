// src/utils/seriesUtils.js

/**
 * Verifica si una serie está completa en orden cronológico
 * Una serie está completa cuando:
 * 1. TODOS sus episodios tienen la propiedad 'order'
 * 2. Los 'order' son CONSECUTIVOS (1, 2, 3, 4...)
 * 
 * @param {Object} serie - La serie a verificar
 * @returns {boolean} - true si la serie está completa, false si no
 */
export const esSerieCompleta = (serie) => {
  // Extraer todos los episodios de la serie
  const todosLosEpisodios = [];
  serie.temporadas.forEach(temp => {
    temp.episodios.forEach(ep => {
      todosLosEpisodios.push(ep);
    });
  });
  
  // Si no tiene episodios, considerarla completa (serie sin episodios individuales)
  if (todosLosEpisodios.length === 0) return true;
  
  // 1. Verificar que TODOS los episodios tengan la propiedad 'order'
  const todosTienenOrder = todosLosEpisodios.every(ep => 
    ep.order !== undefined && ep.order !== null
  );
  if (!todosTienenOrder) return false;
  
  // 2. Verificar que los 'order' sean CONSECUTIVOS (1, 2, 3, 4...)
  const orders = todosLosEpisodios.map(ep => ep.order).sort((a, b) => a - b);
  for (let i = 0; i < orders.length; i++) {
    if (orders[i] !== i + 1) return false;
  }
  
  return true;
};

/**
 * Obtiene todos los episodios de una serie que tienen 'order'
 * @param {Object} serie - La serie a procesar
 * @returns {Array} - Array de episodios con 'order'
 */
export const getEpisodiosConOrder = (serie) => {
  const episodios = [];
  serie.temporadas.forEach(temp => {
    temp.episodios.forEach(ep => {
      if (ep.order !== undefined && ep.order !== null) {
        episodios.push({
          ...ep,
          temporadaId: temp.id,
          temporadaTitle: temp.title,
          serieId: serie.id,
          serieTitle: serie.title,
        });
      }
    });
  });
  return episodios;
};

/**
 * Obtiene todas las temporadas de una serie que tienen episodios
 * @param {Object} serie - La serie a procesar
 * @returns {Array} - Array de temporadas con sus episodios
 */
export const getTemporadasConEpisodios = (serie) => {
  return serie.temporadas.filter(temp => temp.episodios.length > 0);
};