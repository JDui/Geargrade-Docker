const defaultHeaders = {
  Accept: "application/json"
};

async function parseResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let message = `Request failed: ${response.status}`;
    try {
      const payload = await response.json();
      if (payload?.detail) {
        message = payload.detail;
      }
    } catch {
      // Ignore secondary parsing errors.
    }
    throw new Error(message);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export async function apiGet<T>(path: string): Promise<T> {
  const response = await fetch(path, {
    headers: defaultHeaders
  });
  return parseResponse<T>(response);
}

export async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(path, {
    method: "POST",
    headers: {
      ...defaultHeaders,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });
  return parseResponse<T>(response);
}

export async function apiPatch<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(path, {
    method: "PATCH",
    headers: {
      ...defaultHeaders,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });
  return parseResponse<T>(response);
}

export async function apiDelete(path: string): Promise<void> {
  const response = await fetch(path, {
    method: "DELETE",
    headers: defaultHeaders
  });
  return parseResponse<void>(response);
}

export async function apiUpload<T>(path: string, formData: FormData): Promise<T> {
  const response = await fetch(path, {
    method: "POST",
    body: formData
  });
  return parseResponse<T>(response);
}
