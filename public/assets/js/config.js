// Configuración global para el frontend
const APP_CONFIG = {
    
    // Mapeo de los IDs físicos de los dispositivos a las cisternas
    API_URLS: {
        SMAWA_A: "url_endpoint_sensor_a",
        SMAWA_B: "url_endpoint_sensor_b",
        SMAWA_C: "url_endpoint_sensor_c"
    },

    // Diccionario Geométrico y Espacial
    GEOMETRY: {
        "CISTERNA_A": {
            name: "Cisterna A (Potable 1/2)",
            type: "Agua Potable",
            sensor_id: "SMAWA_A", 
            height_m: 2.90,
            area_m2: 400.0, // Mitad de 800m2
            max_capacity_l: 1160000, // Mitad de 2,320,000 L
            location: {
                lat: 19.370417778911108,
                lng: -99.26527563569387
            }
        },
        "CISTERNA_C": {
            name: "Cisterna C (Potable 2/2)",
            type: "Agua Potable",
            sensor_id: "SMAWA_C", 
            height_m: 2.90,
            area_m2: 400.0, // Mitad de 800m2
            max_capacity_l: 1160000, // Mitad de 2,320,000 L
            location: {
                lat: 19.370417778911108,
                lng: -99.26527563569387
            }
        },
        "CISTERNA_B": {
            name: "Cisterna B (Aguas Negras)",
            type: "Agua Tratada",
            sensor_id: "SMAWA_B",
            height_m: 2.40,
            area_m2: 127.4, 
            max_capacity_l: 305760,
            location: {
                lat: 19.370602533885304,
                lng: -99.26519534215821
            }
        },
        "CISTERNA_D": {
            name: "Cisterna D (Chica)",
            type: "Agua Potable",
            sensor_id: null, // Aún no instrumentada
            height_m: 2.38,
            area_m2: 74.0, 
            max_capacity_l: 176120,
            location: {
                lat: 19.366769676264894,
                lng: -99.26525276588227
            }
        }
    }
};
