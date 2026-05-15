"""Run the scheduler process."""

from ndscheduler.server import server


class SimpleServer(server.SchedulerServer):

    # @classmethod
    # def run(cls):
    #     if not cls.singleton:
    #         signal.signal(signal.SIGINT, cls.signal_handler)

    #         cls.singleton = cls(scheduler_manager.SchedulerManager.get_instance())
    #         cls.singleton.start_scheduler()
    #         return cls.singleton.application


    def post_scheduler_start(self):
        jobs = self.scheduler_manager.get_jobs()


if __name__ == "__main__":
    SimpleServer.run()