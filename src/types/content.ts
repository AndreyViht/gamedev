
export interface NewsActionButton {
    text: string;
    url: string;
}
export interface NewsActionButtonClient extends NewsActionButton {
    id: string;
}

export interface NewsItem {
    id: number | string;
    title: string;
    summary?: string;
    content?: string;
    imageUrl?: string;
    created_at?: string;
    is_published?: boolean;
    user_id?: string;
    action_buttons?: NewsActionButton[];
}

export interface NewsItemDB {
    id: string;
    created_at: string;
    title: string;
    content: string | null;
    image_url: string | null;
    user_id: string | null;
    is_published: boolean;
    action_buttons?: NewsActionButton[] | null;
}

export interface ProjectItem {
    id: string | number;
    title: string;
    description: string;
    imageUrl?: string | null;
    status: string;
    genre: string;
    project_url?: string | null;
    source_code_url?: string | null;
}

export interface ProjectItemDB {
    id: string;
    created_at: string;
    title: string;
    description: string | null;
    image_url: string | null;
    status: string | null;
    genre: string | null;
    user_id: string | null;
    is_published: boolean;
    project_url?: string | null;
    source_code_url?: string | null;
}
