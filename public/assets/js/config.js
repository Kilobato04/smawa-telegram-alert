// Configuración global para el frontend SMAWA
const APP_CONFIG = {
    // Solo guardamos los tokens para armar las URLs dinámicamente
    API_TOKENS: {
        SMAWA_A: "c847d8342b77ecc9f882ddce1dc96cfe",
        SMAWA_C: "80ce0fdb376ace3283498aff44a59851",
        SMAWA_B: "342f54b882c7ec70b249dc9981bd47bb"
    },
    GEOMETRY: {
        "CISTERNA_A": {
            name: "Cisterna A (Potable 1/2)",
            sensor_id: "SMAWA_A", 
            height_m: 2.90,
            area_m2: 400.0,
            max_capacity_l: 1160000,
            color: '#007acc',
            lat: "19.370417", lng: "-99.265275"
        },
        "CISTERNA_C": {
            name: "Cisterna C (Potable 2/2)",
            sensor_id: "SMAWA_C", 
            height_m: 2.90,
            area_m2: 400.0,
            max_capacity_l: 1160000,
            color: '#2980b9',
            lat: "19.370417", lng: "-99.265275"
        },
        "CISTERNA_B": {
            name: "Cisterna B (Aguas Negras)",
            sensor_id: "SMAWA_B",
            height_m: 2.40,
            area_m2: 127.4, 
            max_capacity_l: 305760,
            color: '#8e44ad',
            lat: "19.370602", lng: "-99.265195"
        },
        "CISTERNA_D": {
            name: "Cisterna D (Chica)",
            sensor_id: null,
            height_m: 2.38,
            area_m2: 74.0, 
            max_capacity_l: 176120,
            color: '#16a085',
            lat: "19.366769", lng: "-99.265252"
        }
    }
};
