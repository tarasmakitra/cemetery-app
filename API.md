# Cemetery REST API

Base URL: `{SERVER_URL}/api`

## Authentication

All endpoints require a Bearer token in the `Authorization` header:

```
Authorization: Bearer <token>
```

The token is stored in the `apiToken` field of the `User` table. The authenticated user must have admin role (which grants `manage:cemetery` and `upload:images` permissions).

## Response Format

All responses follow the same envelope structure:

**Success:**
```json
{ "status": "ok", "data": <payload> }
```

**Error:**
```json
{ "status": "error", "message": "Human-readable error message" }
```

**Validation error:**
```json
{
  "status": "validation-error",
  "errors": {
    "fieldName": ["Error message 1", "Error message 2"]
  }
}
```

HTTP status codes: `200` success, `201` created, `400` bad request / validation, `403` forbidden, `404` not found.

---

## Data Types

### Grave (input body for POST/PUT)

```typescript
{
    uid?: string,                    // unique identifier; optional on create (auto-generated UUID if omitted), ignored on update (readonly)
        status?: "VISIBLE" | "HIDDEN",   // default: "VISIBLE"
        type?: "REGULAR" | "SMALL" | "DOUBLE" | "TRIPLE" | "TREE" | "OTHER",  // default: "REGULAR"
        location?: string | null,        // grid key like "A8", "H24"
        rotation?: number,               // -180 to +180, default: 0
        latitude?: number | null,
        longitude?: number | null,
        notes?: string | null,
        persons?: GravePerson[],         // default: []
        images?: GraveImageRef[]         // default: []
}
```

### GravePerson (nested in Grave body)

```typescript
{
  name?: string,        // default: ""
  birthDay?: string,    // default: "", day of birth
  birthMonth?: string,  // default: "", month of birth (01-12)
  birthYear?: string,   // default: "", year of birth
  deathDay?: string,    // default: "", day of death
  deathMonth?: string,  // default: "", month of death (01-12)
  deathYear?: string,   // default: "", year of death
  notes?: string        // default: ""
}
```

Array order determines display order (index 0 = order 0, etc.).

### GraveImageRef (nested in Grave body)

```typescript
{
  id: number  // references an Image record (uploaded via /api/image)
}
```

Array order determines display order.

### Grave (response object)

```typescript
{
  id: number,
  uid: string,                     // unique identifier (UUID)
  status: "VISIBLE" | "HIDDEN",
  type: "REGULAR" | "SMALL" | "DOUBLE" | "TRIPLE" | "TREE" | "OTHER",
  location: string | null,
  rotation: number,
  latitude: number | null,
  longitude: number | null,
  notes: string | null,
  search: string,
  createdBy: number | null,
  createdAt: string,   // ISO 8601
  updatedAt: string,   // ISO 8601
  persons: [{
    id: number,
    name: string,
    birthDay: string,
    birthMonth: string,
    birthYear: string,
    deathDay: string,
    deathMonth: string,
    deathYear: string,
    notes: string,
    order: number,
    graveId: number,
    createdAt: string,
    updatedAt: string
  }],
  images: [{
    id: number,
    order: number,
    graveId: number,
    imageId: number,
    image: {
      id: number,
      source: string,       // original image path
      thumbSource: string,  // thumbnail path
      width: number,
      height: number,
      // ... other image fields
    }
  }]
}
```

---

## Endpoints

### GET `/api/cemetery/graves`

List graves with pagination, search, and filtering.

**Query parameters:**

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `page` | number | `1` | Page number (1-based) |
| `size` | number | `10` | Items per page |
| `search` | string | `""` | Search in location and notes (case-sensitive substring match) |
| `status` | string | `""` | Filter by status: `"VISIBLE"` or `"HIDDEN"`. Empty = all |
| `orderBy` | string | `"id"` | Column to sort by (any Grave field) |
| `orderDirection` | string | `"asc"` | `"asc"` or `"desc"` |

**Response:**
```json
{
  "status": "ok",
  "data": {
    "data": [Grave, ...],
    "total": 42
  }
}
```

---

### POST `/api/cemetery/graves`

Create a new grave.

**Request body:** Grave input object (see Data Types above).

**Response (201):**
```json
{
  "status": "ok",
  "data": Grave
}
```

**Minimal example:**
```json
{
  "type": "REGULAR",
  "latitude": 50.371,
  "longitude": 24.628,
  "persons": [{ "name": "Іван Петрович" }]
}
```

**With custom UID:**
```json
{
  "uid": "my-custom-uid",
  "type": "REGULAR",
  "latitude": 50.371,
  "longitude": 24.628,
  "persons": [{ "name": "Іван Петрович" }]
}
```

---

### GET `/api/cemetery/graves/:id`

Get a single grave by ID.

**Response:**
```json
{ "status": "ok", "data": Grave }
```

**404:**
```json
{ "status": "error", "message": "Запис не знайдено." }
```

---

### PUT `/api/cemetery/graves/:id`

Update a grave. Replaces all persons and images (delete + recreate).

**Request body:** Grave input object (same schema as POST). Note: `uid` is ignored on update (readonly after creation).

**Important:** Persons and images arrays are fully replaced. To keep existing persons, include them all in the request. Omitting `persons` or `images` defaults to empty array `[]`, which deletes all existing ones.

**Response:**
```json
{ "status": "ok", "data": Grave }
```

---

### DELETE `/api/cemetery/graves/:id`

Delete a grave and all its persons and images (cascade).

**Response:**
```json
{ "status": "ok", "data": { "id": 42 } }
```

**404:**
```json
{ "status": "error", "message": "Запис не знайдено." }
```

---

### GET `/api/cemetery/graves/map`

Get all graves that have coordinates (latitude and longitude are not null). No pagination — returns all matching records.

**Response:**
```json
{ "status": "ok", "data": [Grave, ...] }
```

---

### POST `/api/cemetery/sync`

Batch sync operations for offline-first workflow. Operations run sequentially. Each operation is independently wrapped in try/catch — one failure does not block the rest.

**Request body:**
```json
{
  "operations": [
    {
      "action": "create",
      "tempId": "client-uuid-1",
      "data": { /* Grave input */ }
    },
    {
      "action": "update",
      "id": 42,
      "data": { /* Grave input */ }
    },
    {
      "action": "delete",
      "id": 37
    }
  ]
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `operations[].action` | `"create"` \| `"update"` \| `"delete"` | yes | Operation type |
| `operations[].tempId` | string | create only | Client-generated ID for mapping |
| `operations[].id` | number | update/delete | Server grave ID |
| `operations[].data` | Grave input | create/update | Grave data (same schema as POST/PUT) |

**Response:**
```json
{
  "status": "ok",
  "data": {
    "results": [
      { "action": "create", "tempId": "client-uuid-1", "serverId": 99, "status": "ok" },
      { "action": "update", "id": 42, "status": "ok" },
      { "action": "delete", "id": 37, "status": "ok" }
    ]
  }
}
```

On per-operation failure:
```json
{ "action": "update", "id": 999, "status": "error", "message": "Error description" }
```

---

### POST `/api/image`

Upload an image file. Returns the created Image record with `id` to use in grave `images` array.

**Request:** `multipart/form-data`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `file` | File | yes | Image file (JPEG, PNG, WebP, etc.) |
| `type` | string | no | Image type/category hint |

**Response:**
```json
{
  "status": "ok",
  "data": {
    "id": 123,
    "source": "/images/abc123.webp",
    "thumbSource": "/images/abc123-thumb.webp",
    "width": 1920,
    "height": 1080,
    "createdBy": 1,
    "createdAt": "2026-02-26T12:00:00.000Z",
    "updatedAt": "2026-02-26T12:00:00.000Z"
  }
}
```

---

## Typical Workflow

1. **Upload images** via `POST /api/image` to get image IDs
2. **Create grave** via `POST /api/cemetery/graves` with person data and image IDs
3. **List/search graves** via `GET /api/cemetery/graves?search=A8`
4. **Load map markers** via `GET /api/cemetery/graves/map`
5. **Offline sync** — queue create/update/delete operations locally, then push via `POST /api/cemetery/sync`

## CORS

The API sets `Access-Control-Allow-Origin: *` on all `/api/cemetery/*` and `/api/image` routes. Preflight `OPTIONS` requests return `204` with CORS headers.
