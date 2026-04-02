async function syncProcess(process_id: number, process_number: string) {
    console.log(">>> [DEBUG] syncProcess iniciada para:", process_number);
    
    try {
      const response = await fetch(`${defaultUrlProd}/functions/v1/datajud-sync`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${defaultKeyProd}`
        },
        body: JSON.stringify({ process_id, process_number })
      });
      
      // Lemos como texto primeiro para ver o que realmente veio
      const responseText = await response.text();
      console.log(">>> [DEBUG] Resposta bruta da Edge Function:", responseText);
      
      let result;
      try {
        result = JSON.parse(responseText);
      } catch (e) {
        console.error(">>> [DEBUG] Falha ao parsear JSON da resposta:", responseText);
        throw new Error("Resposta inválida do servidor (não é JSON)");
      }

      if (response.ok && result.success) {
        alert('Sincronização iniciada com sucesso!');
        window.location.reload();
      } else {
        console.error(">>> [DEBUG] Erro na resposta da Edge Function:", result);
        alert(`Erro ao iniciar sincronização: ${result.error || 'Erro desconhecido'}`);
      }
    } catch (error) {
      console.error(">>> [DEBUG] Erro fatal na comunicação:", error);
      alert('Erro na comunicação com a API de sincronização. Verifique o console (F12).');
    }
  }
