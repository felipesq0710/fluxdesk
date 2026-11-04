// Na demonstração nenhum código deve alcançar o Supabase: todos os serviços foram substituídos.
export const supabase = new Proxy(
  {},
  {
    get(_t, prop) {
      throw new Error(`Supabase indisponível no modo demonstração (propriedade "${String(prop)}").`)
    },
  },
)
