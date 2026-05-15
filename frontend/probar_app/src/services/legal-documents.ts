import { apiAuth } from "./api"

export type LegalDocumentType = "termos_cliente" | "termos_bartender" | "politica_privacidade"

export interface LegalDocument {
    id: number
    titulo: string
    conteudo: string
    versao: string
    tipo: LegalDocumentType
    esta_ativo: boolean
    vigente_a_partir_de: string
    hash_conteudo: string
}

export async function getActiveLegalDocuments(tipoUsuario: string) {
    const response = await apiAuth.get<LegalDocument[]>("/api/v1/documentos-legais/ativos/", {
        params: { tipo_usuario: tipoUsuario },
    })

    return response.data
}
