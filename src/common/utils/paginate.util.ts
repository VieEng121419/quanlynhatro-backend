export interface PaginatedResult<T> {
  items: T[];
  meta: {
    totalItems: number;
    itemCount: number;
    itemsPerPage: number;
    totalPages: number;
    currentPage: number;
  };
}

// Trả về định nghĩa chính xác cấu trúc arguments của Prisma để triệt tiêu any
export interface PrismaQueryOptions {
  where?: Record<string, unknown>;
  include?: Record<string, unknown>;
  orderBy?: Record<string, 'asc' | 'desc'> | Record<string, 'asc' | 'desc'>[];
}

export async function paginate<T>(
  model: {
    findMany: (
      args: PrismaQueryOptions & { skip: number; take: number },
    ) => Promise<T[]>;
    count: (args: { where?: PrismaQueryOptions['where'] }) => Promise<number>;
  },
  queryOptions: PrismaQueryOptions = {},
  pagination: { page: number; limit: number },
): Promise<PaginatedResult<T>> {
  const page = Math.max(1, pagination.page);
  const limit = Math.max(1, pagination.limit);
  const skip = (page - 1) * limit;

  const [items, totalItems] = await Promise.all([
    model.findMany({
      ...queryOptions,
      skip,
      take: limit,
    }),
    model.count({ where: queryOptions.where }),
  ]);

  const totalPages = Math.ceil(totalItems / limit);

  return {
    items,
    meta: {
      totalItems,
      itemCount: items.length,
      itemsPerPage: limit,
      totalPages,
      currentPage: page,
    },
  };
}
