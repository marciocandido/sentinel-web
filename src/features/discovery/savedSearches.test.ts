import { describe, expect, it } from "vitest";
import { savedSearchKindLabel, toEditableDiscoverySearch } from "./savedSearches";

describe("toEditableDiscoverySearch", () => {
  it("maps every primary non-radius kind without changing textual identifiers", () => {
    expect(toEditableDiscoverySearch({kind:"SEGMENT",segment_id:"0123456",uf:null,codigo_tom:"0001",porte_codigo:null,capital_min:null,capital_max:"10",include_discarded:true})).toMatchObject({mode:"filtered",origin:"SEGMENT",values:{segmentId:"0123456",codigoTom:"0001",capitalMax:"10",municipioNome:"",codigoIbge:""},includeDiscarded:true});
    expect(toEditableDiscoverySearch({kind:"REGION",uf:"PR",codigo_tom:null,codigo_ibge:"0410000",municipio_nome:null,segment_id:null})).toMatchObject({mode:"filtered",origin:"REGION",values:{codigoIbge:"0410000",uf:"PR",porteCodigo:"",capitalMin:""}});
    expect(toEditableDiscoverySearch({kind:"FILTERED",segment_id:null,uf:null,municipio_nome:"SÃO PAULO",codigo_tom:"0007",codigo_ibge:"0355030",porte_codigo:"03",capital_min:"100000.00",capital_max:null,include_discarded:true})).toEqual({mode:"filtered",origin:"FILTERED",includeDiscarded:true,values:{segmentId:"",uf:"",municipioNome:"SÃO PAULO",codigoTom:"0007",codigoIbge:"0355030",porteCodigo:"03",capitalMin:"100000.00",capitalMax:""}});
    expect(toEditableDiscoverySearch({kind:"NEIGHBORS",cnpj_full:"00ABC123000100",radius_km:30,segment_id:null,uf:"PR"})).toMatchObject({mode:"neighbors",values:{cnpj:"00ABC123000100",resultUf:"PR"}});
    expect(toEditableDiscoverySearch({kind:"ROOT_BRANCHES",cnpj:"00ABC123000100",cnpj_root:null})).toMatchObject({mode:"root",values:{identifierKind:"cnpj",identifierValue:"00ABC123000100"}});
    expect(toEditableDiscoverySearch({kind:"ROOT_BRANCHES",cnpj:null,cnpj_root:"00123456"})).toMatchObject({mode:"root",values:{identifierKind:"root",identifierValue:"00123456"}});
    expect(toEditableDiscoverySearch({kind:"COMMERCIAL_GROUP",group_id:"0001"})).toMatchObject({mode:"group",values:{groupId:"0001"}});
  });
  it("labels every kind with the human family, never the technical discriminator", () => {
    expect(savedSearchKindLabel).toEqual({
      FILTERED: "Filtros", SEGMENT: "Filtros · Segmento", REGION: "Filtros · Região",
      RADIUS: "Proximidade · Raio", NEIGHBORS: "Proximidade · Vizinhos",
      ROOT_BRANCHES: "Estrutura · Raiz e filiais", COMMERCIAL_GROUP: "Estrutura · Grupo comercial", SIMILAR: "Semelhantes",
    });
  });
  it("rehydrates a radius municipality without coercing textual identifiers", () => {
    expect(toEditableDiscoverySearch({ kind:"RADIUS", origin_municipio_nome:"CURITIBA", origin_uf:"PR", radius_km:30, segment_id:"00123456", include_discarded:true })).toMatchObject({ mode:"radius", includeDiscarded:true, values:{ originKind:"municipality", segmentId:"00123456" } });
  });
  it("rejects ambiguous and drawer-only definitions", () => {
    expect(toEditableDiscoverySearch({ kind:"RADIUS", origin_cnpj:"00ABC", origin_codigo_tom:"001", radius_km:30 })).toBeNull();
    expect(toEditableDiscoverySearch({ kind:"SIMILAR", cnpj_full:"00ABC" })).toBeNull();
  });
  it("accepts null padding but rejects incomplete radius and non-exclusive root identifiers", () => {
    expect(toEditableDiscoverySearch({kind:"RADIUS",radius_km:10,origin_cnpj:"00ABC",origin_lat:null,origin_lon:null,origin_codigo_tom:null,origin_codigo_ibge:null,origin_municipio_nome:null,origin_uf:null})).toMatchObject({mode:"radius",values:{originKind:"cnpj"}});
    expect(toEditableDiscoverySearch({kind:"RADIUS",radius_km:10,origin_lat:-25,origin_lon:null})).toBeNull();
    expect(toEditableDiscoverySearch({kind:"RADIUS",radius_km:10,origin_municipio_nome:"CURITIBA",origin_uf:null})).toBeNull();
    expect(toEditableDiscoverySearch({kind:"ROOT_BRANCHES",cnpj:"00ABC",cnpj_root:"00123456"})).toBeNull();
    expect(toEditableDiscoverySearch({kind:"ROOT_BRANCHES",cnpj:null,cnpj_root:null})).toBeNull();
  });
});
