// Configuración global para el frontend SMAWA
const APP_CONFIG = {
    API_URLS: {
        SMAWA_A: "url_endpoint_sensor_a",
        SMAWA_C: "url_endpoint_sensor_c",
        SMAWA_B: "url_endpoint_sensor_b"
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
            sensor_id: null, // Aún no instrumentada
            height_m: 2.38,
            area_m2: 74.0, 
            max_capacity_l: 176120,
            color: '#16a085',
            lat: "19.366769", lng: "-99.265252"
        }
    }
};
