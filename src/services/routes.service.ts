import { RoutesRepository } from "@/repositories/routes.repository";

const routesRepository = new RoutesRepository();

export class RoutesService {
  async listRoutes() {
    return routesRepository.listActive();
  }
}
